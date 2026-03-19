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
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

# Instala as dependências. 
# Removido --build-from-source=sqlite3 para evitar que o sharp tente compilar sem necessidade.
# Se precisar compilar o sqlite3, faremos em um passo separado.
RUN npm install

# Rebuild opcional do sqlite3 se houver problemas com o binário pré-compilado
RUN npm rebuild sqlite3 --build-from-source

COPY . .

RUN npm run build

EXPOSE 3000

VOLUME ["/data"]

ENTRYPOINT ["node"]
CMD ["dist/bot.js"]
