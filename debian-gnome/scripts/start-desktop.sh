#!/bin/bash
set -u

export DISPLAY=:0
export LANG=C.UTF-8
export LC_ALL=C.UTF-8
export XDG_SESSION_TYPE=x11

mkdir -p /run/dbus /tmp/kem-runtime-user
chown user:user /tmp/kem-runtime-user
chmod 700 /tmp/kem-runtime-user

dbus-uuidgen --ensure=/etc/machine-id >/dev/null 2>&1 || true
dbus-daemon --system --fork >/tmp/dbus-system.log 2>&1 || true

if command -v udevadm >/dev/null 2>&1; then
  /lib/systemd/systemd-udevd --daemon >/tmp/udevd.log 2>&1 || true
  udevadm trigger --action=add >/dev/null 2>&1 || true
  udevadm settle --timeout=3 >/dev/null 2>&1 || true
fi

Xorg :0 vt7 -noreset -nolisten tcp >/tmp/xorg.log 2>&1 &
XORG_PID=$!

for _ in $(seq 1 30); do
  if DISPLAY=:0 xdpyinfo >/dev/null 2>&1; then break; fi
  sleep 0.2
done

if ! DISPLAY=:0 xdpyinfo >/dev/null 2>&1; then
  echo "Xorg did not become ready." >&2
  cat /tmp/xorg.log >&2 || true
  exit 1
fi

export XDG_RUNTIME_DIR=/tmp/kem-runtime-user

su -s /bin/bash user -c '
  export DISPLAY=:0
  export HOME=/home/user
  export USER=user
  export LOGNAME=user
  export LANG=C.UTF-8
  export LC_ALL=C.UTF-8
  export XDG_RUNTIME_DIR=/tmp/kem-runtime-user
  export XDG_SESSION_TYPE=x11
  export XDG_CURRENT_DESKTOP=GNOME-Flashback:GNOME
  export DESKTOP_SESSION=gnome-flashback-metacity
  exec dbus-run-session -- gnome-session --session=gnome-flashback-metacity
'
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  echo "GNOME session exited with $STATUS; starting a GNOME component fallback." >&2
  su -s /bin/bash user -c '
    export DISPLAY=:0
    export HOME=/home/user
    export USER=user
    export LOGNAME=user
    export LANG=C.UTF-8
    export LC_ALL=C.UTF-8
    export XDG_RUNTIME_DIR=/tmp/kem-runtime-user
    exec dbus-run-session -- bash -lc "
      nautilus --no-default-window >/tmp/nautilus.log 2>&1 &
      gnome-panel >/tmp/gnome-panel.log 2>&1 &
      exec metacity
    "
  '
  STATUS=$?
fi

kill "$XORG_PID" 2>/dev/null || true
exit "$STATUS"
