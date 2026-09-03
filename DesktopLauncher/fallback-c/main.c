/*
 * CencomOS Garage - Kiosk Launcher (Win32 + WebView2) [FALLBACK C]
 * Launcher kiosk fullscreen dung WebView2 mo web app CencomOS. Dung lam
 * fallback khi ban Tauri chua build duoc. URL doc tu config.json canh exe
 * ({"url": "..."}), thieu/loi -> mac dinh http://garage.local. Navigation
 * that bai -> retry sau 5 giay, lap vo han. Build: chay build.ps1.
 */

#define WIN32_LEAN_AND_MEAN
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00
#endif
#ifndef NTDDI_VERSION
#define NTDDI_VERSION 0x0A000000
#endif

#include <windows.h>
#include <objbase.h>
#include <shellapi.h>
#include <string.h>
#include <stdio.h>
#include <wchar.h>

/* Fallback cho header WebView2.h khi compile bang C thuan + MinGW */
#ifndef __EventRegistrationToken_defined  /* EventToken.h (WinRT) co the thieu */
typedef struct EventRegistrationToken { LONGLONG value; } EventRegistrationToken;
#define __EventRegistrationToken_defined 1
#endif
#ifndef interface
#define interface struct                  /* MIDL keyword -> struct */
#endif
#ifndef CONST_VTBL
#define CONST_VTBL const
#endif

#include <WebView2.h>  /* lay tu NuGet Microsoft.Web.WebView2 */

#define APP_NAME    L"CencomOS Garage"
#define RETRY_MS    5000
#define TIMER_RETRY 1
#define MAX_URL     512

static HWND g_hwnd = NULL;
static ICoreWebView2 *g_webview = NULL;
static wchar_t g_url[MAX_URL] = L"http://garage.local";
static UINT_PTR g_retry_timer = 0;  /* !=0: dang cho retry */

/* ============ Doc cau hinh URL tu config.json (parse JSON don gian) ============ */

static int valid_url(const char *u) {  /* chi http/https, chan nhay don/kep */
    if (strncmp(u, "http://", 7) != 0 && strncmp(u, "https://", 8) != 0) return 0;
    if (strchr(u, '\'') != NULL) return 0;
    if (strchr(u, '"')  != NULL) return 0;
    return 1;
}

static void read_config(void) {
    wchar_t cfg[MAX_PATH];
    const wchar_t *slash;
    const char *p, *q, *e;
    char buf[8192], url[MAX_URL];
    size_t len;
    FILE *f;

    if (!GetModuleFileNameW(NULL, cfg, MAX_PATH)) return;
    slash = wcsrchr(cfg, L'\\');
    if (!slash) return;
    wcscpy((wchar_t *)(slash + 1), L"config.json");   /* doi ten exe -> config.json */
    f = _wfopen(cfg, L"r");
    if (!f) return;
    len = fread(buf, 1, sizeof(buf) - 1, f);
    fclose(f);
    if (len == 0) return;
    buf[len] = '\0';
    p = strstr(buf, "\"url\"");                       /* tim "url": "..." */
    if (!p) return;
    q = strchr(p, ':');  if (!q) return;
    q = strchr(q, '"');  if (!q) return; q++;         /* nhay mo */
    e = strchr(q, '"');  if (!e) return;              /* nhay dong */
    len = (size_t)(e - q);
    if (len == 0 || len >= MAX_URL) return;
    memcpy(url, q, len);
    url[len] = '\0';
    if (!valid_url(url)) return;                      /* khong hop le -> mac dinh */
    MultiByteToWideChar(CP_UTF8, 0, url, -1, g_url, MAX_URL);  /* UTF-8 -> UTF-16 */
}

/* ============ COM handler viet tay (C thuan, khong can WRL/C++) ============ */

/* AddRef/Release/QueryInterface dung chung cho handler tinh (khong giai phong) */
static ULONG STDMETHODCALLTYPE s_addref(void *s)  { (void)s; return 2; }
static ULONG STDMETHODCALLTYPE s_release(void *s) { (void)s; return 1; }
static HRESULT STDMETHODCALLTYPE s_qi(void *s, REFIID i, void **pp) { (void)i; if (pp) *pp = s; return S_OK; }

static HRESULT STDMETHODCALLTYPE env_completed(
    ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler *This,
    HRESULT errorCode, ICoreWebView2Environment *createdEnvironment);
static HRESULT STDMETHODCALLTYPE ctl_completed(
    ICoreWebView2CreateCoreWebView2ControllerCompletedHandler *This,
    HRESULT errorCode, ICoreWebView2Controller *createdController);
static HRESULT STDMETHODCALLTYPE nav_completed(
    ICoreWebView2NavigationCompletedEventHandler *This,
    ICoreWebView2 *sender, ICoreWebView2NavigationCompletedEventArgs *args);

#define HANDLER(Type, name, fn) \
    static Type##Vtbl name##_vtbl = { s_qi, s_addref, s_release, fn }; \
    static Type name##_handler = { &name##_vtbl };

HANDLER(ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler, g_env, env_completed)
HANDLER(ICoreWebView2CreateCoreWebView2ControllerCompletedHandler, g_ctl, ctl_completed)
HANDLER(ICoreWebView2NavigationCompletedEventHandler, g_nav, nav_completed)

#define FAIL(msg) do { MessageBoxW(g_hwnd, msg, APP_NAME, MB_OK | MB_ICONERROR); PostQuitMessage(1); return S_OK; } while (0)

/* Mo environment xong -> tao controller gan vao cua so kiosk */
static HRESULT STDMETHODCALLTYPE env_completed(
    ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler *This,
    HRESULT errorCode, ICoreWebView2Environment *createdEnvironment) {
    (void)This;
    if (FAILED(errorCode) || !createdEnvironment)
        FAIL(L"Khoi tao WebView2 that bai.\nKiem tra WebView2 Runtime va WebView2Loader.dll.");
    createdEnvironment->lpVtbl->CreateCoreWebView2Controller(createdEnvironment, g_hwnd, &g_ctl_handler);
    return S_OK;
}

/* Tao controller xong -> lay ICoreWebView2, cau hinh bao mat, dieu huong lan dau */
static HRESULT STDMETHODCALLTYPE ctl_completed(
    ICoreWebView2CreateCoreWebView2ControllerCompletedHandler *This,
    HRESULT errorCode, ICoreWebView2Controller *controller) {
    ICoreWebView2 *wv = NULL;
    ICoreWebView2Controller2 *ctrl2 = NULL;
    ICoreWebView2Settings *settings = NULL;
    EventRegistrationToken token;
    HRESULT hr;
    (void)This;

    if (FAILED(errorCode) || !controller)
        FAIL(L"Khong tao duoc WebView2 controller.");
    hr = controller->lpVtbl->get_CoreWebView2(controller, &wv);
    if (FAILED(hr) || !wv)
        FAIL(L"Khong lay duoc ICoreWebView2.");
    g_webview = wv;

    controller->lpVtbl->put_IsVisible(controller, TRUE);

    /* Mau nen toi (slate-900 = RGB 15,23,42); RGBA 0xFF0F172A -> COLORREF 0x000F172A */
    hr = controller->lpVtbl->QueryInterface(controller, &IID_ICoreWebView2Controller2, (void **)&ctrl2);
    if (SUCCEEDED(hr) && ctrl2) {
        ctrl2->lpVtbl->put_DefaultBackgroundColor(ctrl2, 0x000F172A);
        ctrl2->lpVtbl->Release(ctrl2);
    }

    /* Tat DevTools: khong cho nguoi dung mo console debug */
    hr = wv->lpVtbl->get_Settings(wv, &settings);
    if (SUCCEEDED(hr) && settings) {
        settings->lpVtbl->put_AreDevToolsEnabled(settings, FALSE);
        settings->lpVtbl->Release(settings);
    }

    /* Dang ky tu dong ket noi lai khi navigation that bai */
    hr = wv->lpVtbl->add_NavigationCompleted(wv, &g_nav_handler, &token);
    if (FAILED(hr))
        FAIL(L"Khong dang ky duoc NavigationCompleted.");
    wv->lpVtbl->Navigate(wv, g_url);
    return S_OK;
}

/* Navigation that bai -> hen retry sau RETRY_MS (lap vo han toi khi thanh cong) */
static HRESULT STDMETHODCALLTYPE nav_completed(
    ICoreWebView2NavigationCompletedEventHandler *This,
    ICoreWebView2 *sender, ICoreWebView2NavigationCompletedEventArgs *args) {
    BOOL ok = FALSE;
    (void)This; (void)sender;
    if (!g_hwnd || !args) return S_OK;

    args->lpVtbl->get_IsSuccess(args, &ok);
    if (ok) {                                        /* thanh cong -> dung retry */
        if (g_retry_timer) {
            KillTimer(g_hwnd, TIMER_RETRY);
            g_retry_timer = 0;
        }
        return S_OK;
    }
    if (!g_retry_timer)                              /* mang loi -> retry vo han */
        g_retry_timer = SetTimer(g_hwnd, TIMER_RETRY, RETRY_MS, NULL);
    return S_OK;
}

/* ============ Khoi tao WebView2: load WebView2Loader.dll dong ============ */

typedef HRESULT (STDMETHODCALLTYPE *CreateEnvFn)(
    PCWSTR browserExecutableFolder, PCWSTR userDataFolder,
    ICoreWebView2EnvironmentOptions *options,
    ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler *handler);

static void init_webview(void) {
    HMODULE loader;
    CreateEnvFn create_env;
    wchar_t data_folder[MAX_PATH];
    HRESULT hr;

    loader = LoadLibraryW(L"WebView2Loader.dll");    /* dat canh exe, load dong */
    if (!loader) {
        MessageBoxW(g_hwnd, L"Thieu WebView2Loader.dll (dat canh exe).", APP_NAME, MB_OK | MB_ICONERROR);
        PostQuitMessage(1);
        return;
    }
    create_env = (CreateEnvFn)GetProcAddress(loader, "CreateCoreWebView2EnvironmentWithOptions");
    if (!create_env) {
        MessageBoxW(g_hwnd, L"WebView2Loader.dll sai phien ban.", APP_NAME, MB_OK | MB_ICONERROR);
        PostQuitMessage(1);
        return;
    }

    /* Thu muc du lieu user: %LOCALAPPDATA%\CencomGarage\WebView2 */
    if (GetEnvironmentVariableW(L"LOCALAPPDATA", data_folder, MAX_PATH) == 0)
        wcscpy(data_folder, L".");
    else
        wcscat(data_folder, L"\\CencomGarage\\WebView2");

    hr = create_env(NULL, data_folder, NULL, &g_env_handler);   /* options=NULL: dung Edge runtime */
    if (FAILED(hr)) {
        MessageBoxW(g_hwnd, L"Khoi tao WebView2 that bai.", APP_NAME, MB_OK | MB_ICONERROR);
        PostQuitMessage(1);
    }
}

/* ============ Window procedure + entry point ============ */

static const wchar_t CLASS_NAME[] = L"CencomGarageKiosk";

static LRESULT CALLBACK wnd_proc(HWND hwnd, UINT msg, WPARAM wp, LPARAM lp) {
    switch (msg) {
    case WM_KEYDOWN:
        if (wp == VK_ESCAPE) {   /* admin thoat nhanh; bo de kiosk thuan */
            PostQuitMessage(0);
            return 0;
        }
        break;
    case WM_TIMER:
        if (wp == TIMER_RETRY && g_webview) {   /* retry: dieu huong lai URL */
            KillTimer(hwnd, TIMER_RETRY);
            g_retry_timer = 0;
            g_webview->lpVtbl->Navigate(g_webview, g_url);
        }
        return 0;
    case WM_CLOSE:
    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(hwnd, msg, wp, lp);
}

static void register_class(HINSTANCE hInst) {
    WNDCLASSW wc;
    memset(&wc, 0, sizeof(wc));
    wc.lpfnWndProc   = wnd_proc;
    wc.hInstance     = hInst;
    wc.lpszClassName = CLASS_NAME;
    wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);   /* tranh trang nhoay khi tai */
    wc.hCursor       = LoadCursor(NULL, IDC_ARROW);
    RegisterClassW(&wc);
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrev, LPSTR lpCmdLine, int nCmdShow) {
    MSG msg;
    int w, h;
    (void)hPrev; (void)lpCmdLine; (void)nCmdShow;

    read_config();
    CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
    register_class(hInstance);

    /* Fullscreen bang kich thuoc man hinh */
    w = GetSystemMetrics(SM_CXSCREEN);
    h = GetSystemMetrics(SM_CYSCREEN);
    g_hwnd = CreateWindowExW(WS_EX_TOPMOST, CLASS_NAME, APP_NAME, WS_POPUP,
                             0, 0, w, h, NULL, NULL, hInstance, NULL);
    if (!g_hwnd)
        return 1;

    ShowWindow(g_hwnd, SW_SHOW);
    UpdateWindow(g_hwnd);

    init_webview();   /* async: environment -> controller -> navigate */

    while (GetMessageW(&msg, NULL, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    if (g_webview)
        g_webview->lpVtbl->Release(g_webview);
    CoUninitialize();
    return (int)msg.wParam;
}
