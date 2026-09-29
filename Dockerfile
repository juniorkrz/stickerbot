# Painel de administração (React/Vite): compilado à parte e copiado para panel/dist
FROM node:20-bookworm AS panel
WORKDIR /panel
COPY panel/package*.json ./
RUN npm install --no-audit --no-fund
COPY panel/ ./
RUN npm run build

FROM node:20-bookworm

ENV TZ=America/Sao_Paulo

# Instala git e outras dependências nativas
RUN apt update && \
    apt install -y \
    git \
    build-essential \
    pkg-config \
    libvips-dev \
    ffmpeg \
    imagemagick \
    libcairo2-dev \
    libgif-dev \
    libjpeg-dev \
    libpango1.0-dev \
    librsvg2-dev \
    libu2f-udev \
    libxcb1 \
    python3 \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp (comandos mp3/play) + Deno, o runtime JS que o yt-dlp usa para resolver os desafios do YouTube
RUN curl -fsSL -o /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux && \
    chmod +x /usr/local/bin/yt-dlp && \
    curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- -y && \
    yt-dlp --version && deno --version

WORKDIR /usr/src/app

COPY package*.json ./

# Instala as dependências. 
# Removido --build-from-source=sqlite3 para evitar que o sharp tente compilar sem necessidade.
# Se precisar compilar o sqlite3, faremos em um passo separado.
RUN npm install

# Rebuild opcional do sqlite3 se houver problemas com o binário pré-compilado
RUN npm rebuild sqlite3 --build-from-source

COPY . .

COPY --from=panel /panel/dist ./panel/dist

RUN npm run build

EXPOSE 3000

VOLUME ["/data"]

ENTRYPOINT ["node"]
CMD ["dist/bot.js"]
