FROM --platform=linux/i386 docker.io/i386/debian:bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      bash \
      ca-certificates \
      dbus \
      dbus-x11 \
      locales \
      procps \
      sudo \
      udev \
      util-linux \
      xserver-xorg-core \
      xserver-xorg-input-libinput \
      x11-xserver-utils \
      gnome-session-flashback \
      gnome-terminal \
      nautilus \
      adwaita-icon-theme \
      fonts-dejavu-core \
      hicolor-icon-theme \
      shared-mime-info \
      nano && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

RUN sed -i 's/^# *C.UTF-8 UTF-8/C.UTF-8 UTF-8/' /etc/locale.gen 2>/dev/null || true; \
    locale-gen C.UTF-8 || true; \
    dbus-uuidgen --ensure=/etc/machine-id

RUN useradd -m -s /bin/bash user && \
    echo 'user:password' | chpasswd && \
    echo 'root:password' | chpasswd && \
    usermod -aG sudo user && \
    printf 'user ALL=(ALL) NOPASSWD:ALL\n' > /etc/sudoers.d/90-webvm-user && \
    chmod 0440 /etc/sudoers.d/90-webvm-user

COPY scripts/start-desktop.sh /usr/local/bin/start-desktop
RUN chmod 0755 /usr/local/bin/start-desktop

CMD ["/usr/local/bin/start-desktop"]
