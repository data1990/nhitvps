import {
  Activity,
  AlertCircle,
  ArchiveRestore,
  ChevronRight,
  Database,
  Download,
  FileText,
  Folder,
  FolderOpen,
  Globe2,
  HardDrive,
  Home,
  KeyRound,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Package,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
  Upload,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ReadyStatus = "checking" | "ready" | "offline";
type AuthStatus = "checking" | "authenticated" | "unauthenticated";
type ViewName = "Overview" | "Files" | "Websites" | "Databases" | "Security" | "Monitoring" | "Accounts" | "Settings";

type ReadyResponse = {
  status: string;
  checks: Record<string, string>;
  timestamp: string;
};

type PublicUser = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  status: "active" | "disabled" | "locked" | "pending";
  twoFactorEnabled: boolean;
};

type SessionResponse = {
  user: PublicUser;
  session: {
    expiresAt: string;
  };
};

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

type FileRoot = {
  path: string;
  name: string;
};

type FileEntry = {
  name: string;
  path: string;
  type: "directory" | "file" | "symlink" | "other";
  size: number;
  modifiedAt: string;
  mode: string;
};

type FileListResponse = {
  root: string;
  path: string;
  entries: FileEntry[];
};

type FileReadResponse = {
  root: string;
  path: string;
  content: string;
  size: number;
  modifiedAt: string;
};

type SystemMetricsSnapshot = {
  timestamp: string;
  hostname: string;
  platform: string;
  uptimeSeconds: number;
  cpu: {
    cores: number;
    model: string;
    loadAverage: number[];
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
  };
  disks: Array<{
    path: string;
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
  }>;
  network: Array<{
    name: string;
    addresses: string[];
    rxBytes: number | null;
    txBytes: number | null;
  }>;
  process: {
    pid: number;
    uptimeSeconds: number;
    memoryRssBytes: number;
    memoryHeapUsedBytes: number;
    activeHandles: number | null;
    topProcesses: Array<{
      pid: number;
      name: string;
      state: string;
      memoryRssBytes: number;
    }>;
  };
  docker: {
    available: boolean;
    socketPath: string;
    reason: string | null;
  };
};

type MetricsStreamEvent =
  | {
      type: "system_metrics";
      data: SystemMetricsSnapshot;
    }
  | {
      type: "error";
      error: {
        code: string;
        message: string;
      };
    };

type SystemComponent = "certbot" | "mariadb" | "mysql" | "nginx" | "ufw";

type SystemPackageStatus = {
  component: SystemComponent;
  packages: Array<{
    name: string;
    installed: boolean;
    stdout: string;
    stderr: string;
  }>;
};

type SystemPackageStatusResponse = {
  components: SystemPackageStatus[];
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api/v1";

const modules = [
  { name: "File Manager", icon: Folder, accent: "text-sky-600", value: "browse + edit", status: "UI ready" },
  { name: "Nginx", icon: Globe2, accent: "text-emerald-600", value: "vhost + SSL", status: "API ready" },
  { name: "Databases", icon: Database, accent: "text-indigo-600", value: "backup + restore", status: "API ready" },
  { name: "Firewall", icon: Shield, accent: "text-rose-600", value: "UFW adapter", status: "API ready" },
  { name: "Monitoring", icon: Activity, accent: "text-amber-600", value: "HTTP + WS", status: "API ready" },
  { name: "Users", icon: Users, accent: "text-violet-600", value: "RBAC + 2FA", status: "API ready" },
];

const navigation = [
  { name: "Overview", icon: Server },
  { name: "Files", icon: Folder },
  { name: "Websites", icon: Globe2 },
  { name: "Databases", icon: Database },
  { name: "Security", icon: Shield },
  { name: "Monitoring", icon: Activity },
  { name: "Accounts", icon: Users },
  { name: "Settings", icon: Settings },
] satisfies { name: ViewName; icon: typeof Server }[];

const activity = [
  { label: "Core backend", detail: "Fastify API, error contract, env validation", state: "DONE" },
  { label: "Access control", detail: "Session auth, RBAC, TOTP recovery codes", state: "DONE" },
  { label: "System modules", detail: "Files, Nginx, database, firewall, monitoring", state: "DONE" },
  { label: "Frontend auth", detail: "Login, logout, session bootstrap, protected shell", state: "DONE" },
  { label: "File manager UI", detail: "Browse, read, write, upload, download, chmod, chown, zip, unzip", state: "DONE" },
  { label: "Monitoring UI", detail: "System snapshot and realtime WebSocket stream", state: "DONE" },
];

export function App() {
  const [readyStatus, setReadyStatus] = useState<ReadyStatus>("checking");
  const [readyPayload, setReadyPayload] = useState<ReadyResponse | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("checking");
  const [session, setSession] = useState<SessionResponse | null>(null);

  const refreshReadyStatus = useCallback(async () => {
    setReadyStatus("checking");

    try {
      const response = await fetch(`${apiBaseUrl}/ready`, {
        credentials: "include",
        headers: {
          accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Ready check failed with ${response.status}`);
      }

      const payload = (await response.json()) as ReadyResponse;
      setReadyPayload(payload);
      setReadyStatus(payload.status === "ready" ? "ready" : "offline");
      setLastCheckedAt(new Date().toLocaleTimeString());
    } catch {
      setReadyPayload(null);
      setReadyStatus("offline");
      setLastCheckedAt(new Date().toLocaleTimeString());
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setAuthStatus("checking");

    try {
      const payload = await requestSession();
      setSession(payload);
      setAuthStatus("authenticated");
    } catch {
      setSession(null);
      setAuthStatus("unauthenticated");
    }
  }, []);

  const handleLogin = useCallback(async (identifier: string, password: string) => {
    const payload = await requestLogin(identifier, password);
    setSession(payload);
    setAuthStatus("authenticated");
  }, []);

  const handleLogout = useCallback(async () => {
    await requestLogout();
    setSession(null);
    setAuthStatus("unauthenticated");
  }, []);

  useEffect(() => {
    void refreshReadyStatus();
    void refreshSession();
  }, [refreshReadyStatus, refreshSession]);

  const statusMeta = useMemo(() => {
    if (readyStatus === "ready") {
      return {
        label: "API ready",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        dot: "bg-emerald-500",
      };
    }

    if (readyStatus === "checking") {
      return {
        label: "Checking API",
        className: "border-amber-200 bg-amber-50 text-amber-700",
        dot: "bg-amber-500",
      };
    }

    return {
      label: "API offline",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      dot: "bg-rose-500",
    };
  }, [readyStatus]);

  if (authStatus === "checking") {
    return <LoadingScreen statusMeta={statusMeta} />;
  }

  if (authStatus === "unauthenticated") {
    return <LoginScreen onLogin={handleLogin} readyStatusMeta={statusMeta} onRefreshReady={refreshReadyStatus} />;
  }

  return (
    <DashboardShell
      lastCheckedAt={lastCheckedAt}
      onLogout={handleLogout}
      onRefreshReady={refreshReadyStatus}
      readyPayload={readyPayload}
      session={session}
      statusMeta={statusMeta}
    />
  );
}

type StatusMeta = {
  label: string;
  className: string;
  dot: string;
};

function LoadingScreen({ statusMeta }: { statusMeta: StatusMeta }) {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-100 px-4 text-slate-950">
      <section className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-6 shadow-panel">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-slate-950 text-white">
            <HardDrive size={19} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-base font-semibold">NhiTVPS</h1>
            <p className="text-sm text-slate-500">Checking session</p>
          </div>
        </div>
        <div className={`mt-5 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${statusMeta.className}`}>
          <span className={`size-2 rounded-full ${statusMeta.dot}`} />
          <span>{statusMeta.label}</span>
        </div>
      </section>
    </main>
  );
}

function LoginScreen({
  onLogin,
  onRefreshReady,
  readyStatusMeta,
}: {
  onLogin: (identifier: string, password: string) => Promise<void>;
  onRefreshReady: () => Promise<void>;
  readyStatusMeta: StatusMeta;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await onLogin(identifier, password);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-100 text-slate-950">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-4 py-8 lg:grid-cols-[1fr_420px] lg:px-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-md bg-slate-950 text-white">
              <HardDrive size={21} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">NhiTVPS</p>
              <p className="text-sm text-slate-500">VPS Control Panel</p>
            </div>
          </div>

          <h1 className="mt-8 max-w-xl text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
            Secure operations workspace
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
            Sign in to manage files, websites, databases, firewall rules, monitoring streams, and privileged VPS actions.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Shield, label: "RBAC", detail: "Permission guard" },
              { icon: KeyRound, label: "2FA", detail: "TOTP ready" },
              { icon: ArchiveRestore, label: "Audit", detail: "Ops tracked" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-md border border-slate-200 bg-white p-4">
                  <Icon className="text-slate-700" size={19} aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Sign in</h2>
              <p className="text-sm text-slate-500">Use your panel account</p>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${readyStatusMeta.className}`}>
              <span className={`size-2 rounded-full ${readyStatusMeta.dot}`} />
              <span>{readyStatusMeta.label}</span>
            </div>
          </div>

          <form className="mt-5 space-y-4" onSubmit={(event) => void submitLogin(event)}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email or username</span>
              <span className="mt-2 flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-slate-950">
                <Mail size={18} className="text-slate-400" aria-hidden="true" />
                <input
                  autoComplete="username"
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="admin@example.com"
                  required
                  type="text"
                  value={identifier}
                />
              </span>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <span className="mt-2 flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-slate-950">
                <KeyRound size={18} className="text-slate-400" aria-hidden="true" />
                <input
                  autoComplete="current-password"
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  type="password"
                  value={password}
                />
              </span>
            </label>

            {errorMessage ? (
              <div className="flex gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isSubmitting}
              type="submit"
            >
              <LogIn size={18} aria-hidden="true" />
              <span>{isSubmitting ? "Signing in" : "Sign in"}</span>
            </button>

            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={() => void onRefreshReady()}
              type="button"
            >
              <RefreshCw size={17} aria-hidden="true" />
              <span>Refresh API status</span>
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

function DashboardShell({
  lastCheckedAt,
  onLogout,
  onRefreshReady,
  readyPayload,
  session,
  statusMeta,
}: {
  lastCheckedAt: string | null;
  onLogout: () => Promise<void>;
  onRefreshReady: () => Promise<void>;
  readyPayload: ReadyResponse | null;
  session: SessionResponse | null;
  statusMeta: StatusMeta;
}) {
  const user = session?.user;
  const displayName = user?.displayName || user?.username || "Operator";
  const [activeView, setActiveView] = useState<ViewName>("Overview");

  return (
    <div className="min-h-screen bg-neutral-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="grid size-9 place-items-center rounded-md bg-slate-950 text-white">
            <HardDrive size={19} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">NhiTVPS</p>
            <p className="text-xs text-slate-500">Control Panel</p>
          </div>
        </div>

        <nav className="space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition ${
                  item.name === activeView ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
                onClick={() => setActiveView(item.name)}
                type="button"
                title={item.name}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <h1 className="text-lg font-semibold text-slate-950">{activeView}</h1>
              <p className="text-sm text-slate-500">VPS operations workspace</p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`hidden items-center gap-2 rounded-md border px-3 py-2 text-sm sm:flex ${statusMeta.className}`}>
                <span className={`size-2 rounded-full ${statusMeta.dot}`} />
                <span>{statusMeta.label}</span>
              </div>
              <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 md:flex">
                <UserCheck size={17} aria-hidden="true" />
                <span className="max-w-36 truncate" title={displayName}>
                  {displayName}
                </span>
              </div>
              <button
                className="grid size-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={() => void onRefreshReady()}
                title="Refresh API status"
                type="button"
              >
                <RefreshCw size={18} aria-hidden="true" />
              </button>
              <button
                className="grid size-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={() => void onLogout()}
                title="Log out"
                type="button"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        {activeView === "Files" ? (
          <FileManagerView />
        ) : activeView === "Monitoring" ? (
          <MonitoringView />
        ) : activeView === "Settings" ? (
          <SystemSetupView />
        ) : activeView === "Websites" || activeView === "Databases" || activeView === "Security" ? (
          <OperationsView view={activeView} />
        ) : (
          <OverviewContent
            lastCheckedAt={lastCheckedAt}
            readyPayload={readyPayload}
            session={session}
            statusMeta={statusMeta}
            user={user}
          />
        )}
      </main>
    </div>
  );
}

function OverviewContent({
  lastCheckedAt,
  readyPayload,
  session,
  statusMeta,
  user,
}: {
  lastCheckedAt: string | null;
  readyPayload: ReadyResponse | null;
  session: SessionResponse | null;
  statusMeta: StatusMeta;
  user: PublicUser | undefined;
}) {
  return (
    <section className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
            <section className="rounded-md border border-slate-200 bg-white p-5 shadow-panel">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">System Surface</h2>
                  <p className="text-sm text-slate-500">Backend modules currently available for UI integration</p>
                </div>
                <div className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm ${statusMeta.className}`}>
                  <span className={`size-2 rounded-full ${statusMeta.dot}`} />
                  <span>{statusMeta.label}</span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {modules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <article key={module.name} className="rounded-md border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className={`grid size-10 place-items-center rounded-md bg-slate-100 ${module.accent}`}>
                          <Icon size={20} aria-hidden="true" />
                        </div>
                        <span className="rounded-sm bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{module.status}</span>
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-slate-950">{module.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{module.value}</p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-5 shadow-panel">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-md bg-slate-100 text-slate-700">
                  <LockKeyhole size={19} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-950">Runtime</h2>
                  <p className="text-sm text-slate-500">Last checked {lastCheckedAt ?? "not yet"}</p>
                </div>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Signed in</dt>
                  <dd className="max-w-40 truncate font-medium text-slate-950" title={user?.email}>
                    {user?.email ?? "-"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">API base</dt>
                  <dd className="font-medium text-slate-950">{apiBaseUrl}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <dt className="text-slate-500">Config</dt>
                  <dd className="font-medium text-slate-950">{readyPayload?.checks.config ?? "-"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Session expires</dt>
                  <dd className="max-w-44 truncate font-medium text-slate-950" title={session?.session.expiresAt}>
                    {session ? new Date(session.session.expiresAt).toLocaleString() : "-"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="mt-4 rounded-md border border-slate-200 bg-white shadow-panel">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">Delivery Log</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {activity.map((item) => (
                <div key={item.label} className="grid gap-2 px-5 py-4 sm:grid-cols-[180px_1fr_120px] sm:items-center">
                  <p className="text-sm font-medium text-slate-950">{item.label}</p>
                  <p className="text-sm text-slate-500">{item.detail}</p>
                  <span
                    className={`w-fit rounded-sm px-2 py-1 text-xs font-semibold ${
                      item.state === "DONE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {item.state}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </section>
  );
}

function FileManagerView() {
  const [roots, setRoots] = useState<FileRoot[]>([]);
  const [selectedRoot, setSelectedRoot] = useState("");
  const [currentPath, setCurrentPath] = useState(".");
  const [listing, setListing] = useState<FileListResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileReadResponse | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chmodMode, setChmodMode] = useState("0644");
  const [chownUid, setChownUid] = useState("");
  const [chownGid, setChownGid] = useState("");
  const [zipTarget, setZipTarget] = useState("archive.zip");
  const [unzipTarget, setUnzipTarget] = useState(".");
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const showError = useCallback((error: unknown) => {
    setErrorMessage(error instanceof Error ? error.message : "Operation failed");
    setNotice(null);
  }, []);

  const loadDirectory = useCallback(
    async (root: string, path: string) => {
      setIsBusy(true);
      setErrorMessage(null);

      try {
        const payload = await requestFileList(root, path);
        setSelectedRoot(payload.root);
        setCurrentPath(payload.path);
        setListing(payload);
        setSelectedFile(null);
        setEditorContent("");
      } catch (error) {
        showError(error);
      } finally {
        setIsBusy(false);
      }
    },
    [showError],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadRoots() {
      setIsBusy(true);
      setErrorMessage(null);

      try {
        const payload = await requestFileRoots();

        if (!isMounted) {
          return;
        }

        setRoots(payload);
        const firstRoot = payload[0]?.path ?? "";
        setSelectedRoot(firstRoot);

        if (firstRoot) {
          const listPayload = await requestFileList(firstRoot, ".");

          if (isMounted) {
            setCurrentPath(listPayload.path);
            setListing(listPayload);
          }
        }
      } catch (error) {
        if (isMounted) {
          showError(error);
        }
      } finally {
        if (isMounted) {
          setIsBusy(false);
        }
      }
    }

    void loadRoots();

    return () => {
      isMounted = false;
    };
  }, [showError]);

  async function openEntry(entry: FileEntry) {
    if (!selectedRoot) {
      return;
    }

    if (entry.type === "directory") {
      await loadDirectory(selectedRoot, entry.path);
      return;
    }

    if (entry.type !== "file") {
      setNotice("Only regular files can be opened in the editor.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const payload = await requestFileRead(selectedRoot, entry.path);
      setSelectedFile(payload);
      setEditorContent(payload.content);
      setChmodMode(entry.mode);
      setNotice(`Opened ${entry.name}`);
    } catch (error) {
      showError(error);
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshCurrentDirectory() {
    if (selectedRoot) {
      await loadDirectory(selectedRoot, currentPath);
    }
  }

  async function goToParent() {
    if (selectedRoot) {
      await loadDirectory(selectedRoot, parentPath(currentPath));
    }
  }

  async function saveSelectedFile() {
    if (!selectedRoot || !selectedFile) {
      return;
    }

    await runFileAction(async () => {
      await requestFileWrite(selectedRoot, selectedFile.path, editorContent, true);
      const updatedFile = await requestFileRead(selectedRoot, selectedFile.path);
      setSelectedFile(updatedFile);
      setEditorContent(updatedFile.content);
      await loadDirectory(selectedRoot, currentPath);
      setNotice(`Saved ${selectedFile.path}`);
    });
  }

  async function downloadSelectedFile(path = selectedFile?.path) {
    if (!selectedRoot || !path) {
      return;
    }

    await runFileAction(async () => {
      await requestFileDownload(selectedRoot, path);
      setNotice(`Downloaded ${path}`);
    });
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!selectedRoot || !file) {
      return;
    }

    await runFileAction(async () => {
      await requestFileUpload(selectedRoot, currentPath, file, true);
      await loadDirectory(selectedRoot, currentPath);
      setNotice(`Uploaded ${file.name}`);
    });
  }

  async function applyChmod() {
    if (!selectedRoot || !selectedFile) {
      return;
    }

    await runFileAction(async () => {
      await requestFileChmod(selectedRoot, selectedFile.path, chmodMode);
      await loadDirectory(selectedRoot, currentPath);
      setNotice(`Changed mode for ${selectedFile.path}`);
    });
  }

  async function applyChown() {
    if (!selectedRoot || !selectedFile) {
      return;
    }

    const uid = chownUid.trim() ? Number(chownUid) : undefined;
    const gid = chownGid.trim() ? Number(chownGid) : undefined;

    await runFileAction(async () => {
      await requestFileChown(selectedRoot, selectedFile.path, uid, gid);
      await loadDirectory(selectedRoot, currentPath);
      setNotice(`Changed owner for ${selectedFile.path}`);
    });
  }

  async function createArchive() {
    if (!selectedRoot) {
      return;
    }

    const sourcePath = selectedFile?.path ?? currentPath;

    await runFileAction(async () => {
      await requestFileZip(selectedRoot, [sourcePath], zipTarget, true);
      await loadDirectory(selectedRoot, currentPath);
      setNotice(`Created ${zipTarget}`);
    });
  }

  async function extractArchive() {
    if (!selectedRoot || !selectedFile) {
      return;
    }

    await runFileAction(async () => {
      await requestFileUnzip(selectedRoot, selectedFile.path, unzipTarget || currentPath, true);
      await loadDirectory(selectedRoot, currentPath);
      setNotice(`Extracted ${selectedFile.path}`);
    });
  }

  async function runFileAction(action: () => Promise<void>) {
    setIsBusy(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      await action();
    } catch (error) {
      showError(error);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <section className="rounded-md border border-slate-200 bg-white shadow-panel">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">File Manager</h2>
              <p className="text-sm text-slate-500">Sandboxed roots, text editor, transfer and archive actions</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-10 max-w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
                disabled={isBusy || roots.length === 0}
                onChange={(event) => void loadDirectory(event.target.value, ".")}
                value={selectedRoot}
              >
                {roots.length === 0 ? <option value="">No roots</option> : null}
                {roots.map((root) => (
                  <option key={root.path} value={root.path}>
                    {root.name}
                  </option>
                ))}
              </select>
              <button
                className="grid size-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                disabled={isBusy || !selectedRoot}
                onClick={() => void refreshCurrentDirectory()}
                title="Refresh directory"
                type="button"
              >
                <RefreshCw size={18} aria-hidden="true" />
              </button>
              <button
                className="grid size-10 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                disabled={isBusy || !selectedRoot}
                onClick={() => uploadInputRef.current?.click()}
                title="Upload file"
                type="button"
              >
                <Upload size={18} aria-hidden="true" />
              </button>
              <input className="hidden" onChange={(event) => void uploadFile(event)} ref={uploadInputRef} type="file" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3 text-sm text-slate-600">
            <button
              className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 px-3 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              disabled={isBusy || currentPath === "."}
              onClick={() => void goToParent()}
              type="button"
            >
              <Home size={16} aria-hidden="true" />
              <span>Parent</span>
            </button>
            <span className="truncate">
              {selectedRoot || "-"}
              <ChevronRight className="mx-1 inline" size={14} aria-hidden="true" />
              {currentPath}
            </span>
          </div>

          {errorMessage ? (
            <div className="mx-5 mt-4 flex gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {notice ? <div className="mx-5 mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

          <div className="overflow-x-auto">
            <table className="mt-4 min-w-full border-t border-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Mode</th>
                  <th className="px-5 py-3">Size</th>
                  <th className="px-5 py-3">Modified</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listing?.entries.map((entry) => (
                  <tr key={entry.path} className={selectedFile?.path === entry.path ? "bg-sky-50" : "bg-white"}>
                    <td className="px-5 py-3">
                      <button
                        className="inline-flex max-w-72 items-center gap-2 truncate text-left font-medium text-slate-900 hover:text-sky-700"
                        disabled={isBusy}
                        onClick={() => void openEntry(entry)}
                        type="button"
                      >
                        {entry.type === "directory" ? (
                          <FolderOpen className="shrink-0 text-sky-600" size={18} aria-hidden="true" />
                        ) : (
                          <FileText className="shrink-0 text-slate-500" size={18} aria-hidden="true" />
                        )}
                        <span className="truncate">{entry.name}</span>
                      </button>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{entry.mode}</td>
                    <td className="px-5 py-3 text-slate-500">{formatBytes(entry.size)}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(entry.modifiedAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          className="grid size-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                          disabled={isBusy || entry.type !== "file"}
                          onClick={() => void downloadSelectedFile(entry.path)}
                          title="Download"
                          type="button"
                        >
                          <Download size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {listing?.entries.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm text-slate-500" colSpan={5}>
                      Empty directory
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Editor</h2>
                <p className="max-w-72 truncate text-sm text-slate-500" title={selectedFile?.path}>
                  {selectedFile?.path ?? "No file selected"}
                </p>
              </div>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isBusy || !selectedFile}
                onClick={() => void saveSelectedFile()}
                type="button"
              >
                <Save size={16} aria-hidden="true" />
                <span>Save</span>
              </button>
            </div>
            <textarea
              className="mt-4 h-80 w-full resize-y rounded-md border border-slate-300 bg-slate-950 p-3 font-mono text-sm text-slate-50 outline-none focus:border-sky-400"
              disabled={!selectedFile}
              onChange={(event) => setEditorContent(event.target.value)}
              placeholder="Open a text file to edit"
              spellCheck={false}
              value={editorContent}
            />
            <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-500">
              <span>{selectedFile ? formatBytes(selectedFile.size) : "-"}</span>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                disabled={isBusy || !selectedFile}
                onClick={() => void downloadSelectedFile()}
                type="button"
              >
                <Download size={16} aria-hidden="true" />
                <span>Download</span>
              </button>
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-panel">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-semibold text-slate-950">Operations</h2>
              <p className="text-sm text-slate-500">Applies to the selected file unless noted</p>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                  onChange={(event) => setChmodMode(event.target.value)}
                  placeholder="0644"
                  value={chmodMode}
                />
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  disabled={isBusy || !selectedFile}
                  onClick={() => void applyChmod()}
                  type="button"
                >
                  <Wrench size={16} aria-hidden="true" />
                  <span>chmod</span>
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                  inputMode="numeric"
                  onChange={(event) => setChownUid(event.target.value)}
                  placeholder="uid"
                  value={chownUid}
                />
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                  inputMode="numeric"
                  onChange={(event) => setChownGid(event.target.value)}
                  placeholder="gid"
                  value={chownGid}
                />
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  disabled={isBusy || !selectedFile || (!chownUid.trim() && !chownGid.trim())}
                  onClick={() => void applyChown()}
                  type="button"
                >
                  <UserCheck size={16} aria-hidden="true" />
                  <span>chown</span>
                </button>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                  onChange={(event) => setZipTarget(event.target.value)}
                  placeholder="archive.zip"
                  value={zipTarget}
                />
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  disabled={isBusy || !selectedRoot || !zipTarget.trim()}
                  onClick={() => void createArchive()}
                  type="button"
                >
                  <Package size={16} aria-hidden="true" />
                  <span>zip</span>
                </button>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
                  onChange={(event) => setUnzipTarget(event.target.value)}
                  placeholder="."
                  value={unzipTarget}
                />
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  disabled={isBusy || !selectedFile || !selectedFile.path.toLowerCase().endsWith(".zip")}
                  onClick={() => void extractArchive()}
                  type="button"
                >
                  <ArchiveRestore size={16} aria-hidden="true" />
                  <span>unzip</span>
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function MonitoringView() {
  const [snapshot, setSnapshot] = useState<SystemMetricsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = await requestSystemMetrics();
      setSnapshot(payload);
      setLastEventAt(new Date().toLocaleTimeString());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load metrics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshot();

    return () => {
      socketRef.current?.close();
    };
  }, [loadSnapshot]);

  function startStream() {
    socketRef.current?.close();
    setErrorMessage(null);
    const socket = new WebSocket(toWebSocketUrl("/monitoring/system/stream?intervalMs=3000"));
    socketRef.current = socket;
    setIsStreaming(true);

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as MetricsStreamEvent;

        if (payload.type === "system_metrics") {
          setSnapshot(payload.data);
          setLastEventAt(new Date().toLocaleTimeString());
          return;
        }

        setErrorMessage(payload.error.message);
      } catch {
        setErrorMessage("Failed to parse monitoring stream event");
      }
    };

    socket.onerror = () => {
      setErrorMessage("Monitoring stream connection failed");
    };

    socket.onclose = () => {
      setIsStreaming(false);
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }

  function stopStream() {
    socketRef.current?.close();
    socketRef.current = null;
    setIsStreaming(false);
  }

  const memoryPercent = snapshot?.memory.usedPercent ?? 0;
  const primaryDisk = snapshot?.disks[0];
  const processMemory = snapshot?.process.memoryRssBytes ?? 0;

  return (
    <section className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">System Monitoring</h2>
              <p className="text-sm text-slate-500">
                {snapshot ? `${snapshot.hostname} · ${snapshot.platform} · updated ${lastEventAt ?? "-"}` : "No snapshot loaded"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                disabled={isLoading}
                onClick={() => void loadSnapshot()}
                type="button"
              >
                <RefreshCw size={17} aria-hidden="true" />
                <span>Refresh</span>
              </button>
              <button
                className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                  isStreaming ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-slate-950 text-white hover:bg-slate-800"
                }`}
                onClick={isStreaming ? stopStream : startStream}
                type="button"
              >
                <Activity size={17} aria-hidden="true" />
                <span>{isStreaming ? "Stop stream" : "Start stream"}</span>
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-4 flex gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="CPU" value={snapshot ? `${snapshot.cpu.cores} cores` : "-"} detail={snapshot?.cpu.model ?? "-"} />
            <MetricCard label="Memory" value={`${memoryPercent}%`} detail={`${formatBytes(snapshot?.memory.usedBytes ?? 0)} used`} />
            <MetricCard label="Disk" value={primaryDisk ? `${primaryDisk.usedPercent}%` : "-"} detail={primaryDisk?.path ?? "-"} />
            <MetricCard label="Process RSS" value={formatBytes(processMemory)} detail={snapshot ? `PID ${snapshot.process.pid}` : "-"} />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <MetricPanel title="Memory">
              <ProgressRow label="Used" value={snapshot?.memory.usedPercent ?? 0} />
              <dl className="mt-4 grid gap-2 text-sm">
                <MetricLine label="Total" value={formatBytes(snapshot?.memory.totalBytes ?? 0)} />
                <MetricLine label="Free" value={formatBytes(snapshot?.memory.freeBytes ?? 0)} />
                <MetricLine label="Uptime" value={formatDuration(snapshot?.uptimeSeconds ?? 0)} />
              </dl>
            </MetricPanel>

            <MetricPanel title="Docker">
              <div className={`rounded-md border px-3 py-2 text-sm ${snapshot?.docker.available ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                {snapshot?.docker.available ? "Docker socket available" : snapshot?.docker.reason ?? "Docker not detected"}
              </div>
              <p className="mt-3 truncate text-sm text-slate-500" title={snapshot?.docker.socketPath}>
                {snapshot?.docker.socketPath ?? "-"}
              </p>
            </MetricPanel>
          </div>
        </section>

        <aside className="space-y-4">
          <MetricPanel title="Disks">
            <div className="space-y-3">
              {(snapshot?.disks ?? []).map((disk) => (
                <div key={disk.path}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="max-w-56 truncate font-medium text-slate-700" title={disk.path}>
                      {disk.path}
                    </span>
                    <span className="text-slate-500">{formatBytes(disk.usedBytes)}</span>
                  </div>
                  <ProgressRow label={disk.path} value={disk.usedPercent} compact />
                </div>
              ))}
              {snapshot?.disks.length === 0 ? <p className="text-sm text-slate-500">No disk metrics</p> : null}
            </div>
          </MetricPanel>

          <MetricPanel title="Network">
            <div className="max-h-64 space-y-3 overflow-auto pr-1">
              {(snapshot?.network ?? []).map((item) => (
                <div key={item.name} className="rounded-md border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-950">{item.name}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{item.addresses.join(", ") || "No address"}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <span>RX {item.rxBytes === null ? "-" : formatBytes(item.rxBytes)}</span>
                    <span>TX {item.txBytes === null ? "-" : formatBytes(item.txBytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          </MetricPanel>
        </aside>
      </div>

      <section className="mt-4 rounded-md border border-slate-200 bg-white shadow-panel">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Top Processes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">PID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">State</th>
                <th className="px-5 py-3">RSS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(snapshot?.process.topProcesses ?? []).map((process) => (
                <tr key={process.pid}>
                  <td className="px-5 py-3 font-medium text-slate-950">{process.pid}</td>
                  <td className="px-5 py-3 text-slate-600">{process.name}</td>
                  <td className="px-5 py-3 text-slate-500">{process.state}</td>
                  <td className="px-5 py-3 text-slate-500">{formatBytes(process.memoryRssBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function MetricCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <article className="rounded-md border border-slate-200 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 truncate text-sm text-slate-500" title={detail}>
        {detail}
      </p>
    </article>
  );
}

function MetricPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-panel">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProgressRow({ compact, label, value }: { compact?: boolean; label: string; value: number }) {
  const clamped = Math.max(0, Math.min(value, 100));

  return (
    <div>
      {!compact ? (
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">{label}</span>
          <span className="text-slate-500">{clamped}%</span>
        </div>
      ) : null}
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-sky-600" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-950">{value}</dd>
    </div>
  );
}

const systemComponents = [
  { id: "nginx", name: "Nginx", detail: "Web server and reverse proxy", icon: Globe2 },
  { id: "mysql", name: "MySQL", detail: "MySQL database server", icon: Database },
  { id: "mariadb", name: "MariaDB", detail: "MariaDB database server", icon: Database },
  { id: "ufw", name: "UFW Firewall", detail: "Ubuntu uncomplicated firewall", icon: Shield },
  { id: "certbot", name: "Certbot", detail: "Let's Encrypt certificate tooling", icon: LockKeyhole },
] satisfies Array<{ id: SystemComponent; name: string; detail: string; icon: typeof Server }>;

function SystemSetupView() {
  const [statuses, setStatuses] = useState<SystemPackageStatus[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function runSystemAction(actionId: string, action: () => Promise<unknown>) {
    setBusyAction(actionId);
    setErrorMessage(null);
    setResult(null);

    try {
      const payload = await action();
      setResult(JSON.stringify(payload, null, 2));

      if (actionId.startsWith("status")) {
        const statusPayload = payload as SystemPackageStatusResponse;
        setStatuses(statusPayload.components);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "System operation failed");
    } finally {
      setBusyAction(null);
    }
  }

  const statusByComponent = new Map(statuses.map((status) => [status.component, status]));

  return (
    <section className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Server Setup</h2>
              <p className="text-sm text-slate-500">Install and check core host components through protected backend commands</p>
            </div>
            <ActionRow>
              <OperationButton
                disabled={busyAction !== null}
                icon={RefreshCw}
                label="Check all"
                onClick={() => runSystemAction("status-all", () => requestSystemPackageStatus())}
              />
              <OperationButton
                disabled={busyAction !== null}
                icon={Package}
                label="Install stack"
                onClick={() => runSystemAction("install-stack", () => installSystemPackageStack(["nginx", "mysql", "ufw", "certbot"]))}
              />
            </ActionRow>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {systemComponents.map((component) => {
              const Icon = component.icon;
              const status = statusByComponent.get(component.id);
              const installedCount = status?.packages.filter((item) => item.installed).length ?? 0;
              const packageCount = status?.packages.length ?? 0;
              const isInstalled = packageCount > 0 && installedCount === packageCount;
              const statusLabel = status ? (isInstalled ? "Installed" : `${installedCount}/${packageCount} packages`) : "Unknown";

              return (
                <article key={component.id} className="rounded-md border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700">
                        <Icon size={19} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-950">{component.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{component.detail}</p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-sm px-2 py-1 text-xs font-medium ${
                        isInstalled ? "bg-emerald-50 text-emerald-700" : status ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {status ? (
                    <dl className="mt-4 space-y-2 text-sm">
                      {status.packages.map((packageStatus) => (
                        <div key={packageStatus.name} className="flex items-center justify-between gap-3">
                          <dt className="truncate text-slate-500">{packageStatus.name}</dt>
                          <dd className={packageStatus.installed ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
                            {packageStatus.installed ? "ok" : "missing"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}

                  <ActionRow>
                    <OperationButton
                      disabled={busyAction !== null}
                      icon={RefreshCw}
                      label="Check"
                      onClick={() => runSystemAction(`status-${component.id}`, () => requestSystemPackageStatus(component.id))}
                    />
                    <OperationButton
                      disabled={busyAction !== null}
                      icon={Package}
                      label="Install"
                      onClick={() => runSystemAction(`install-${component.id}`, () => installSystemPackage(component.id))}
                    />
                  </ActionRow>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-panel">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-950">System Result</h2>
            <p className="text-sm text-slate-500">Package manager response from the backend</p>
          </div>
          {busyAction ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <RefreshCw className="animate-spin" size={16} aria-hidden="true" />
              <span>Running {busyAction}</span>
            </div>
          ) : null}
          {errorMessage ? (
            <div className="mt-4 flex gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          ) : null}
          <pre className="mt-4 max-h-[580px] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">
            {result ?? "No system operation run yet"}
          </pre>
        </section>
      </div>
    </section>
  );
}

function OperationsView({ view }: { view: "Websites" | "Databases" | "Security" }) {
  const [result, setResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [site, setSite] = useState({
    id: "example-com",
    domain: "example.com",
    mode: "static",
    documentRoot: "/var/www/example.com",
    upstreamUrl: "http://127.0.0.1:3000",
    accessLogPath: "/var/log/nginx/example.access.log",
    errorLogPath: "/var/log/nginx/example.error.log",
    email: "admin@example.com",
  });
  const [database, setDatabase] = useState({
    name: "app_db",
    username: "app_user",
    password: "ChangeMeStrongPass123!",
    host: "localhost",
    backupPath: "",
    checksumSha256: "",
  });
  const [firewall, setFirewall] = useState({
    id: "allow-ssh-admin",
    name: "Allow SSH admin",
    action: "allow",
    type: "whitelist",
    targetKind: "cidr",
    targetValue: "127.0.0.1/32",
    port: "22",
    protocol: "tcp",
  });

  async function runOperation(action: () => Promise<unknown>) {
    setIsBusy(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const payload = await action();
      setResult(JSON.stringify(payload, null, 2));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-panel">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-950">{view} Operations</h2>
            <p className="text-sm text-slate-500">Privileged actions are submitted to backend APIs with session/RBAC enforcement</p>
          </div>

          {view === "Websites" ? (
            <div className="mt-5 grid gap-4">
              <OperationGrid>
                <TextField label="Site ID" value={site.id} onChange={(value) => setSite({ ...site, id: value })} />
                <TextField label="Domain" value={site.domain} onChange={(value) => setSite({ ...site, domain: value })} />
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Mode</span>
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    onChange={(event) => setSite({ ...site, mode: event.target.value })}
                    value={site.mode}
                  >
                    <option value="static">static</option>
                    <option value="reverse_proxy">reverse_proxy</option>
                  </select>
                </label>
                <TextField label="Document root" value={site.documentRoot} onChange={(value) => setSite({ ...site, documentRoot: value })} />
                <TextField label="Upstream URL" value={site.upstreamUrl} onChange={(value) => setSite({ ...site, upstreamUrl: value })} />
                <TextField label="Access log" value={site.accessLogPath} onChange={(value) => setSite({ ...site, accessLogPath: value })} />
                <TextField label="Error log" value={site.errorLogPath} onChange={(value) => setSite({ ...site, errorLogPath: value })} />
                <TextField label="SSL email" value={site.email} onChange={(value) => setSite({ ...site, email: value })} />
              </OperationGrid>
              <ActionRow>
                <OperationButton disabled={isBusy} icon={Globe2} label="Create vhost" onClick={() => runOperation(() => createNginxSite(site))} />
                <OperationButton disabled={isBusy} icon={Activity} label="Test config" onClick={() => runOperation(() => postOperation("/nginx/test"))} />
                <OperationButton disabled={isBusy} icon={RefreshCw} label="Reload" onClick={() => runOperation(() => postOperation("/nginx/reload"))} />
                <OperationButton disabled={isBusy} icon={Shield} label="Issue SSL" onClick={() => runOperation(() => issueLetsEncrypt(site))} />
              </ActionRow>
            </div>
          ) : null}

          {view === "Databases" ? (
            <div className="mt-5 grid gap-4">
              <OperationGrid>
                <TextField label="Database" value={database.name} onChange={(value) => setDatabase({ ...database, name: value })} />
                <TextField label="Username" value={database.username} onChange={(value) => setDatabase({ ...database, username: value })} />
                <TextField label="Host" value={database.host} onChange={(value) => setDatabase({ ...database, host: value })} />
                <TextField label="Password" type="password" value={database.password} onChange={(value) => setDatabase({ ...database, password: value })} />
                <TextField label="Restore backup path" value={database.backupPath} onChange={(value) => setDatabase({ ...database, backupPath: value })} />
                <TextField label="Checksum SHA-256" value={database.checksumSha256} onChange={(value) => setDatabase({ ...database, checksumSha256: value })} />
              </OperationGrid>
              <ActionRow>
                <OperationButton disabled={isBusy} icon={Database} label="Provision" onClick={() => runOperation(() => provisionDatabase(database))} />
                <OperationButton disabled={isBusy} icon={ArchiveRestore} label="Backup" onClick={() => runOperation(() => postOperation("/databases/backups", { databaseName: database.name }))} />
                <OperationButton
                  disabled={isBusy || !database.backupPath.trim()}
                  icon={RefreshCw}
                  label="Restore"
                  onClick={() =>
                    runOperation(() =>
                      postOperation("/databases/restore", {
                        backupPath: database.backupPath,
                        checksumSha256: database.checksumSha256 || undefined,
                      }),
                    )
                  }
                />
              </ActionRow>
            </div>
          ) : null}

          {view === "Security" ? (
            <div className="mt-5 grid gap-4">
              <OperationGrid>
                <TextField label="Rule ID" value={firewall.id} onChange={(value) => setFirewall({ ...firewall, id: value })} />
                <TextField label="Rule name" value={firewall.name} onChange={(value) => setFirewall({ ...firewall, name: value })} />
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Action</span>
                  <select className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" onChange={(event) => setFirewall({ ...firewall, action: event.target.value })} value={firewall.action}>
                    <option value="allow">allow</option>
                    <option value="deny">deny</option>
                    <option value="limit">limit</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Target kind</span>
                  <select className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm" onChange={(event) => setFirewall({ ...firewall, targetKind: event.target.value })} value={firewall.targetKind}>
                    <option value="ip">ip</option>
                    <option value="cidr">cidr</option>
                    <option value="port">port</option>
                  </select>
                </label>
                <TextField label="Target value" value={firewall.targetValue} onChange={(value) => setFirewall({ ...firewall, targetValue: value })} />
                <TextField label="Port" value={firewall.port} onChange={(value) => setFirewall({ ...firewall, port: value })} />
              </OperationGrid>
              <ActionRow>
                <OperationButton disabled={isBusy} icon={Shield} label="Firewall status" onClick={() => runOperation(() => requestJson("/firewall/status"))} />
                <OperationButton disabled={isBusy} icon={Wrench} label="Apply rule" onClick={() => runOperation(() => applyFirewallRule(firewall))} />
              </ActionRow>
            </div>
          ) : null}
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-panel">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-950">Result</h2>
            <p className="text-sm text-slate-500">Last operation response</p>
          </div>
          {errorMessage ? (
            <div className="mt-4 flex gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          ) : null}
          <pre className="mt-4 max-h-[520px] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-50">
            {result ?? "No operation run yet"}
          </pre>
        </section>
      </div>
    </section>
  );
}

function OperationGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function TextField({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-950"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function OperationButton({
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  disabled: boolean;
  icon: typeof Server;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon size={17} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

async function requestSession(): Promise<SessionResponse> {
  const response = await fetch(`${apiBaseUrl}/auth/me`, {
    credentials: "include",
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Authentication is required");
  }

  return (await response.json()) as SessionResponse;
}

async function requestLogin(identifier: string, password: string): Promise<SessionResponse> {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ identifier, password }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(payload?.error?.message ?? "Login failed");
  }

  return (await response.json()) as SessionResponse;
}

async function requestLogout(): Promise<void> {
  await fetch(`${apiBaseUrl}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: {
      accept: "application/json",
    },
  });
}

async function requestFileRoots(): Promise<FileRoot[]> {
  const payload = await requestJson<{ roots: FileRoot[] }>("/files/roots");
  return payload.roots;
}

async function requestFileList(root: string, path: string): Promise<FileListResponse> {
  return await requestJson<FileListResponse>(`/files/list?${toFileQuery(root, path)}`);
}

async function requestFileRead(root: string, path: string): Promise<FileReadResponse> {
  return await requestJson<FileReadResponse>(`/files/read?${toFileQuery(root, path)}`);
}

async function requestFileWrite(root: string, path: string, content: string, overwrite: boolean): Promise<void> {
  await requestJson("/files/write", {
    method: "POST",
    body: JSON.stringify({ root, path, content, overwrite }),
  });
}

async function requestFileChmod(root: string, path: string, mode: string): Promise<void> {
  await requestJson("/files/chmod", {
    method: "POST",
    body: JSON.stringify({ root, path, mode }),
  });
}

async function requestFileChown(root: string, path: string, uid?: number, gid?: number): Promise<void> {
  await requestJson("/files/chown", {
    method: "POST",
    body: JSON.stringify({ root, path, uid, gid }),
  });
}

async function requestFileZip(root: string, sourcePaths: string[], targetPath: string, overwrite: boolean): Promise<void> {
  await requestJson("/files/zip", {
    method: "POST",
    body: JSON.stringify({ root, sourcePaths, targetPath, overwrite }),
  });
}

async function requestFileUnzip(root: string, archivePath: string, targetDirectory: string, overwrite: boolean): Promise<void> {
  await requestJson("/files/unzip", {
    method: "POST",
    body: JSON.stringify({ root, archivePath, targetDirectory, overwrite }),
  });
}

async function requestFileUpload(root: string, path: string, file: File, overwrite: boolean): Promise<void> {
  const body = new FormData();
  body.set("root", root);
  body.set("path", path);
  body.set("overwrite", String(overwrite));
  body.set("file", file);

  const response = await fetch(`${apiBaseUrl}/files/upload`, {
    method: "POST",
    credentials: "include",
    headers: {
      accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

async function requestFileDownload(root: string, path: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/files/download?${toFileQuery(root, path)}`, {
    credentials: "include",
    headers: {
      accept: "application/octet-stream",
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = path.split("/").pop() || "download";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function requestSystemMetrics(): Promise<SystemMetricsSnapshot> {
  return await requestJson<SystemMetricsSnapshot>("/monitoring/system");
}

async function requestSystemPackageStatus(component?: SystemComponent): Promise<SystemPackageStatusResponse> {
  const query = component ? `?component=${encodeURIComponent(component)}` : "";
  return await requestJson<SystemPackageStatusResponse>(`/system/packages/status${query}`);
}

async function installSystemPackage(component: SystemComponent): Promise<unknown> {
  return await postOperation("/system/packages/install", {
    component,
    startService: true,
  });
}

async function installSystemPackageStack(components: SystemComponent[]): Promise<unknown> {
  return await postOperation("/system/packages/install-stack", {
    components,
  });
}

async function postOperation(path: string, body?: unknown): Promise<unknown> {
  return await requestJson(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function createNginxSite(site: {
  accessLogPath: string;
  documentRoot: string;
  domain: string;
  errorLogPath: string;
  id: string;
  mode: string;
  upstreamUrl: string;
}): Promise<unknown> {
  return await postOperation("/nginx/sites", {
    id: site.id,
    domain: site.domain,
    aliases: [],
    mode: site.mode,
    documentRoot: site.mode === "static" ? site.documentRoot : undefined,
    upstreamUrl: site.mode === "reverse_proxy" ? site.upstreamUrl : undefined,
    sslMode: "none",
    accessLogPath: site.accessLogPath,
    errorLogPath: site.errorLogPath,
    enabled: true,
  });
}

async function issueLetsEncrypt(site: { domain: string; email: string }): Promise<unknown> {
  return await postOperation("/nginx/ssl/lets-encrypt", {
    domain: site.domain,
    aliases: [],
    email: site.email,
    redirect: true,
    staging: false,
  });
}

async function provisionDatabase(database: {
  host: string;
  name: string;
  password: string;
  username: string;
}): Promise<unknown> {
  return await postOperation("/databases/provision", {
    name: database.name,
    username: database.username,
    host: database.host,
    password: database.password,
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci",
    privileges: ["SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "INDEX", "DROP"],
  });
}

async function applyFirewallRule(firewall: {
  action: string;
  id: string;
  name: string;
  port: string;
  protocol: string;
  targetKind: string;
  targetValue: string;
  type: string;
}): Promise<unknown> {
  const target =
    firewall.targetKind === "port"
      ? { kind: "port", value: Number(firewall.targetValue) }
      : { kind: firewall.targetKind, value: firewall.targetValue };

  return await postOperation("/firewall/rules/apply", {
    id: firewall.id,
    name: firewall.name,
    type: firewall.type,
    action: firewall.action,
    direction: "inbound",
    protocol: firewall.protocol,
    targets: [target],
    ports: firewall.port.trim() ? [Number(firewall.port)] : [],
    priority: 1000,
    status: "pending_apply",
  });
}

async function requestJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as T;
}

async function readApiError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
  return payload?.error?.message ?? `Request failed with ${response.status}`;
}

function toFileQuery(root: string, path: string): string {
  const params = new URLSearchParams();
  params.set("root", root);
  params.set("path", path);
  return params.toString();
}

function parentPath(path: string): string {
  if (path === "." || !path) {
    return ".";
  }

  const parts = path.split("/").filter(Boolean);
  parts.pop();
  return parts.length > 0 ? parts.join("/") : ".";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.trunc(seconds));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function toWebSocketUrl(path: string): string {
  const base = apiBaseUrl.startsWith("http") ? new URL(apiBaseUrl) : new URL(apiBaseUrl, window.location.origin);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `${base.pathname.replace(/\/$/, "")}${path}`;
  base.search = "";
  return base.toString();
}
