/*
 * ============================================================================
 *  CencomOS Garage - Kiosk Launcher DON GIAN  [FALLBACK TOI GIAN]
 * ============================================================================
 *  Ban fallback toi gian dam bao chay duoc 100% (neu may co Microsoft Edge):
 *  chi mo URL bang Edge app-mode qua ShellExecute. Khong can WebView2,
 *  khong can WebView2Loader.dll.
 *
 *  - Doc URL tu file config.json CANH exe:
 *        { "url": "http://garage.local" }
 *    Neu thieu file / loi -> dung mac dinh http://garage.local.
 *  - Neu khong tim thay msedge.exe -> mo bang trinh duyet mac dinh.
 *
 *  Build: gcc main-simple.c -o cencom-launcher-simple.exe -mwindows -lshell32
 * ============================================================================
 */

#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <shellapi.h>    /* ShellExecuteA */
#include <string.h>
#include <stdio.h>
#include <wchar.h>

#define MAX_URL 512
#define DEFAULT_URL "http://garage.local"

/* Chi chap nhan http/https, chan nhay don/nhay kep (bao mat) */
static int valid_url(const char *u) {
    if (strncmp(u, "http://", 7) != 0 && strncmp(u, "https://", 8) != 0)
        return 0;
    if (strchr(u, '\'') != NULL)
        return 0;
    if (strchr(u, '"') != NULL)
        return 0;
    return 1;
}

/* Doc URL tu config.json (parse JSON don gian) -> out (UTF-8) */
static void read_url(char *out, size_t cap) {
    wchar_t cfg[MAX_PATH];
    const wchar_t *slash;
    char buf[8192];
    const char *p, *q, *e;
    size_t len;
    FILE *f;

    strncpy(out, DEFAULT_URL, cap);
    out[cap - 1] = '\0';

    if (!GetModuleFileNameW(NULL, cfg, MAX_PATH))
        return;
    slash = wcsrchr(cfg, L'\\');
    if (!slash)
        return;
    wcscpy((wchar_t *)(slash + 1), L"config.json");

    f = _wfopen(cfg, L"r");
    if (!f)
        return;
    len = fread(buf, 1, sizeof(buf) - 1, f);
    fclose(f);
    if (len == 0)
        return;
    buf[len] = '\0';

    p = strstr(buf, "\"url\"");
    if (!p)
        return;
    q = strchr(p, ':');   if (!q) return;
    q = strchr(q, '"');   if (!q) return;   q++;
    e = strchr(q, '"');   if (!e) return;
    len = (size_t)(e - q);
    if (len == 0 || len >= MAX_URL)
        return;

    {
        char tmp[MAX_URL];
        memcpy(tmp, q, len);
        tmp[len] = '\0';
        if (!valid_url(tmp))
            return;
        strncpy(out, tmp, cap);
        out[cap - 1] = '\0';
    }
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrev, LPSTR lpCmdLine, int nCmdShow) {
    char url[MAX_URL];
    char args[MAX_URL + 64];
    HINSTANCE r;

    (void)hInstance; (void)hPrev; (void)lpCmdLine; (void)nCmdShow;

    read_url(url, sizeof(url));

    /* Mo Edge o che do app (cua so rieng, khu vuc rieng) */
    snprintf(args, sizeof(args), "--app=%s --new-window", url);
    r = ShellExecuteA(NULL, "open", "msedge.exe", args, NULL, SW_SHOWNORMAL);

    /* msedge.exe khong tim thay / loi -> mo URL bang trinh duyet mac dinh */
    if ((INT_PTR)r <= 32)
        ShellExecuteA(NULL, "open", url, NULL, NULL, SW_SHOWNORMAL);

    return 0;
}
