#!/usr/bin/env bash
# FullStack Academy — one-line installer for macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/DashAkoul/fullstack-academy/main/scripts/install.sh | bash
#
# Environment overrides:
#   FSA_REPO   GitHub repo slug (default: DashAkoul/fullstack-academy)
#   FSA_DIR    install directory for the Linux AppImage (default: ~/.local/bin)
set -euo pipefail

REPO="${FSA_REPO:-DashAkoul/fullstack-academy}"
APP_NAME="FullStack Academy"

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mخطا:\033[0m %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || die "curl لازم است. آن را نصب کنید و دوباره تلاش کنید."

OS="$(uname -s)"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64 | amd64) ARCH_TOKEN="x86_64" ;;
  arm64 | aarch64) ARCH_TOKEN="arm64" ;;
  *) die "معماری پشتیبانی‌نشده: $ARCH" ;;
esac

say "دریافت آخرین نسخه از GitHub…"
RELEASE_JSON="$(curl -fsSL -H 'User-Agent: FSA-Installer' "https://api.github.com/repos/$REPO/releases/latest")" \
  || die "دریافت اطلاعات نسخه ناموفق بود. اتصال اینترنت یا نام مخزن را بررسی کنید."

TAG="$(printf '%s' "$RELEASE_JSON" | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name":[[:space:]]*"([^"]+)".*/\1/')"
[ -n "$TAG" ] || die "هیچ نسخه‌ی منتشرشده‌ای پیدا نشد."
say "آخرین نسخه: $TAG"

pick_asset() {
  printf '%s' "$RELEASE_JSON" \
    | grep -o '"browser_download_url":[[:space:]]*"[^"]*"' \
    | sed -E 's/.*"(https[^"]+)"$/\1/' \
    | grep -Ei "$1" \
    | head -n1
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [ "$OS" = "Darwin" ]; then
  [ "$ARCH_TOKEN" = "arm64" ] && MAC_ARCH="arm64" || MAC_ARCH="x64"
  URL="$(pick_asset "mac-${MAC_ARCH}.*\\.zip$")"
  [ -n "$URL" ] || URL="$(pick_asset 'mac.*\.zip$')"
  [ -n "$URL" ] || die "بسته‌ی macOS در این نسخه پیدا نشد."
  if [ "${FSA_PRINT_ONLY:-}" = "1" ]; then say "FSA_URL=$URL"; exit 0; fi

  say "دانلود $(basename "$URL")…"
  curl -fL --progress-bar "$URL" -o "$TMP_DIR/app.zip"

  say "استخراج برنامه…"
  rm -rf "$TMP_DIR/extract" && mkdir -p "$TMP_DIR/extract"
  if command -v ditto >/dev/null 2>&1; then
    ditto -x -k "$TMP_DIR/app.zip" "$TMP_DIR/extract"
  else
    unzip -q "$TMP_DIR/app.zip" -d "$TMP_DIR/extract"
  fi

  APP_BUNDLE="$(find "$TMP_DIR/extract" -maxdepth 2 -name '*.app' -type d | head -n1)"
  [ -n "$APP_BUNDLE" ] || die "برنامه در بسته پیدا نشد."

  TARGET_DIR="/Applications"
  [ -w "$TARGET_DIR" ] || TARGET_DIR="$HOME/Applications"
  mkdir -p "$TARGET_DIR"
  say "نصب در $TARGET_DIR…"
  rm -rf "$TARGET_DIR/$(basename "$APP_BUNDLE")"
  cp -R "$APP_BUNDLE" "$TARGET_DIR/"
  xattr -dr com.apple.quarantine "$TARGET_DIR/$(basename "$APP_BUNDLE")" 2>/dev/null || true

  say "نصب شد. برنامه را از Spotlight یا Launchpad با نام «$APP_NAME» باز کنید."
  exit 0
fi

# ---------- Linux ----------
URL="$(pick_asset "linux-${ARCH_TOKEN}.*\.AppImage$")"
[ -n "$URL" ] || URL="$(pick_asset "linux-${ARCH_TOKEN}.*\.deb$")"
if [ -n "$URL" ] && printf '%s' "$URL" | grep -qi '\.AppImage$'; then
  INSTALL_DIR="${FSA_DIR:-$HOME/.local/bin}"
  if [ "${FSA_PRINT_ONLY:-}" = "1" ]; then say "FSA_URL=$URL"; exit 0; fi
  say "دانلود $(basename "$URL")…"
  mkdir -p "$INSTALL_DIR"
  curl -fL --progress-bar "$URL" -o "$TMP_DIR/app.AppImage"
  install -Dm755 "$TMP_DIR/app.AppImage" "$INSTALL_DIR/fullstack-academy"

  ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
  mkdir -p "$ICON_DIR"
  if [ -f "$INSTALL_DIR/fullstack-academy" ]; then
    # Extract the bundled icon if the AppImage provides one.
    ( cd "$TMP_DIR" && "$INSTALL_DIR/fullstack-academy" --appimage-extract '*.png' >/dev/null 2>&1 || true )
    PNG="$(find "$TMP_DIR/squashfs-root" -name '*.png' 2>/dev/null | head -n1 || true)"
    [ -n "$PNG" ] && cp "$PNG" "$ICON_DIR/fullstack-academy.png" || true
  fi

  DESKTOP_DIR="$HOME/.local/share/applications"
  mkdir -p "$DESKTOP_DIR"
  cat > "$DESKTOP_DIR/fullstack-academy.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=FullStack Academy
Comment=Persian full-stack learning path with AI code review
Exec=$INSTALL_DIR/fullstack-academy %U
Icon=fullstack-academy
Terminal=false
Categories=Education;Development;
StartupWMClass=FullStack Academy
EOF
  chmod +x "$DESKTOP_DIR/fullstack-academy.desktop"
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true

  say "نصب شد: $INSTALL_DIR/fullstack-academy"
  case ":$PATH:" in
    *":$INSTALL_DIR:"*) say "اجرا: fullstack-academy" ;;
    *) say "برای اجرا این خط را به ~/.bashrc یا ~/.zshrc اضافه کنید:"
       printf '  export PATH="%s:$PATH"\n' "$INSTALL_DIR"
       say "یا همین حالا اجرا کنید: $INSTALL_DIR/fullstack-academy" ;;
  esac
  exit 0
fi

if [ -z "$URL" ]; then
  die "بسته‌ی مناسب معماری $ARCH_TOKEN برای لینوکس پیدا نشد. از صفحه‌ی نسخه‌ها به‌صورت دستی دانلود کنید."
fi
DEB_URL="$URL"
[ -n "$DEB_URL" ] || die "بسته‌ی لینوکس در این نسخه پیدا نشد."
if [ "${FSA_PRINT_ONLY:-}" = "1" ]; then say "FSA_URL=$DEB_URL"; exit 0; fi
say "دانلود $(basename "$DEB_URL")…"
curl -fL --progress-bar "$DEB_URL" -o "$TMP_DIR/app.deb"
if command -v apt-get >/dev/null 2>&1; then
  say "نصب بسته (ممکن است رمز sudo خواسته شود)…"
  sudo apt-get install -y "$TMP_DIR/app.deb"
else
  die "نصب خودکار ممکن نشد (apt در دسترس نیست). بسته‌ی deb را دستی نصب کنید: $TMP_DIR/app.deb"
fi
say "نصب کامل شد. برنامه را از منوی برنامه‌ها با نام «$APP_NAME» باز کنید."
