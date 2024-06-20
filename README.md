# StickerBot 🤖

 💻 Originalmente desenvolvido em Python, migrado para JavaScript e agora escrito em TypeScript. 🎉

StickerBot é um bot de figurinhas com uma vasta gama de comandos. Ele pode:
- Auxiliar na administração do seu grupo
- Divertir os membros
- Criar figurinhas incríveis

## 🤖 Showcase
- Veja o bot em funcionamento [aqui](https://api.whatsapp.com/send/?phone=5581973241677&text=!menu).

## 📝 Lista de Tarefas
- Confira as tarefas pendentes e o progresso do projeto [aqui](TODO.md).

## 🚀 Funcionalidades Principais
- **Administração de Grupo:** Comandos para gerenciar e moderar grupos.
- **Criação de Figurinhas:** Transforme imagens, vídeos e textos em figurinhas personalizadas.
- **Diversão:** Baixe músicas do YouTube diretamente pelo WhatsApp.

## 📦 Instalação

1. Clone este repositório:
    ```bash
    git clone https://github.com/juniorkrz/stickerbot
    ```
2. Navegue até o diretório do projeto:
    ```bash
    cd stickerbot
    ```
3. Instale as dependências:
    ```bash
    npm install
    ```
4. Configure as variáveis de ambiente necessárias (veja [.env.example](.env.example) para referência).

## 🚀 Como Usar

Compilando o projeto:
```bash
npm run build
```

Inicie o bot com o comando:
```bash
node .\dist\bot.js
```

Desenvolvimento:
```bash
npm run debug
```

## 🐳 Via Docker
Build:
```bash
docker build -t juniorkrz/stickerbot .
```

Run:
```bash
docker run -d --name stickerbot -p 3000:3000 -v [/your/data/folder]:/data juniorkrz/stickerbot
```

### Como escanear o código QR

Assim que o contêiner estiver em execução, você precisará vincular seu telefone a ele. Para fazer isso, você tem algumas opções:

- `http://localhost:3000/qr` para ver uma pequena página com o QR Code para digitalizar.
- `docker logs -f stickerbot` para abrir o log. O QR será impresso lá. (Via Docker)

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Faça commit das suas alterações (`git commit -m 'Adiciona nova feature'`)
4. Faça push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 👨🏻‍💻 Autor
- [Antônio Roberto Júnior](https://github.com/juniorkrz)

## 📄 Licença

Este projeto está licenciado sob a Licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## ⚙ Feito com
![TypeScript](https://camo.githubusercontent.com/a00920b123df05b3df5e368e509f18bacd65bc5909698fb42be5f35063550f47/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f747970657363726970742d2532333030374143432e7376673f7374796c653d666f722d7468652d6261646765266c6f676f3d74797065736372697074266c6f676f436f6c6f723d7768697465)
![Docker](https://camo.githubusercontent.com/8396abd667a0eca7d28cdb29ec63b6bf29a7854c7c3d467e6ece648c7e9b81e1/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f646f636b65722d2532333064623765642e7376673f7374796c653d666f722d7468652d6261646765266c6f676f3d646f636b6572266c6f676f436f6c6f723d7768697465)

## 🌟 Agradecimentos

Obrigado a todos os contribuidores e usuários que tornam este projeto possível!

---

Feito com 💜 por [Juniorkrz](https://github.com/juniorkrz)