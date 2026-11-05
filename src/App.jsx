import { AppDataProvider, useAppData } from "./AppData.jsx";
import { AuthProvider, useAuth } from "./Auth.jsx";
import { isFirebaseConfigured } from "./firebase.js";
import { NavigationProvider, useNavigation, VIEWS } from "./Navigation.jsx";
import { LocalDataBanner } from "./components/LocalDataBanner.jsx";
import { TaskPreviewDialog } from "./components/TaskPreviewDialog.jsx";
import { UserMenu } from "./components/UserMenu.jsx";
import { CalendarView } from "./views/CalendarView.jsx";
import { DashboardView } from "./views/DashboardView.jsx";
import { GradesView } from "./views/GradesView.jsx";
import { HelpView } from "./views/HelpView.jsx";
import { LoginView } from "./views/LoginView.jsx";
import { ScheduleView } from "./views/ScheduleView.jsx";
import { SetupScreen } from "./views/SetupScreen.jsx";
import { SubjectsView } from "./views/SubjectsView.jsx";
import { TasksView } from "./views/TasksView.jsx";

// Wszystkie widoki są cały czas wyrenderowane (niewidoczne mają atrybut hidden),
// więc np. wpisany w formularzu tekst nie znika po przejściu do innej zakładki.
const VIEW_COMPONENTS = {
    dashboard: DashboardView,
    zadania: TasksView,
    kalendarz: CalendarView,
    "plan-zajec": ScheduleView,
    przedmioty: SubjectsView,
    oceny: GradesView,
    pomoc: HelpView
};

export function App() {
    if (!isFirebaseConfigured) {
        return <SetupScreen />;
    }

    return (
        <AuthProvider>
            <AuthGate />
        </AuthProvider>
    );
}

// Niezalogowany -> ekran logowania; zalogowany -> aplikacja z danymi jego konta.
function AuthGate() {
    const { user, loggingOut } = useAuth();

    if (loggingOut) {
        return <LoadingScreen text="Wylogowywanie…" />;
    }

    if (user === undefined) {
        return <LoadingScreen />;
    }

    if (user === null) {
        return <LoginView />;
    }

    // key: po zmianie konta dane wczytują się od nowa.
    return (
        <AppDataProvider key={user.uid} uid={user.uid}>
            <NavigationProvider>
                <Layout />
            </NavigationProvider>
        </AppDataProvider>
    );
}

function LoadingScreen({ text = "Wczytywanie…" }) {
    return (
        <div className="auth-page">
            <p className="loading-text" role="status">{text}</p>
        </div>
    );
}

function Layout() {
    const { loaded, syncError, clearSyncError } = useAppData();
    const { view, previewTaskId } = useNavigation();

    if (!loaded) {
        return <LoadingScreen text="Wczytywanie Twoich danych…" />;
    }

    return (
        <div className="app">
            <aside className="sidebar">
                <h2 className="logo">Study<span>Flow</span></h2>

                <nav>
                    {Object.entries(VIEWS).map(([name, { label }]) => (
                        <a
                            key={name}
                            href={`#${name}`}
                            className={name === view ? "active" : undefined}
                            aria-current={name === view ? "page" : undefined}
                        >
                            {label}
                        </a>
                    ))}
                </nav>

                <div className="sidebar-footer">StudyFlow v0.3</div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <div>
                        <p className="subtitle">{VIEWS[view].subtitle}</p>
                        <h1>{VIEWS[view].title}</h1>
                    </div>

                    <UserMenu />
                </header>

                {syncError && (
                    <div className="import-status error app-banner" role="alert">
                        <p>{syncError}</p>
                        <button type="button" className="link-button" onClick={clearSyncError}>Zamknij</button>
                    </div>
                )}

                <LocalDataBanner />

                {Object.entries(VIEW_COMPONENTS).map(([name, ViewComponent]) => (
                    <div key={name} className="view" hidden={name !== view}>
                        <ViewComponent />
                    </div>
                ))}
            </main>

            {previewTaskId && <TaskPreviewDialog />}
        </div>
    );
}
