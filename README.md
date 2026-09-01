# 365 TV

Sistema de mídia e informações para a TV da loja 365 Motos. Um único app Electron faz duas coisas ao mesmo tempo:

- **Player**: abre em tela cheia (kiosk) e exibe vídeos, tarjeta de promoção, relógio, clima, música e logo.
- **Servidor local**: hospedado dentro do próprio app, expõe o Painel Administrativo (acessível de outro PC da mesma rede) e um socket em tempo real que atualiza a TV instantaneamente quando algo é publicado no painel.

## Como rodar

```
npm install
npm start
```

Isso abre a janela em tela cheia (Ctrl+Alt+Q sai do modo kiosk, útil durante a instalação/manutenção) e sobe o servidor em `http://localhost:3450`.

## Gerando o instalador para o PC da TV

O modo acima (`npm start`) é só para desenvolvimento/testes. Para instalar de verdade no mini PC que vai ficar ligado na TV, gere um instalador `.exe`:

```
npm run dist
```

Isso cria o arquivo `release/365 TV Setup <versão>.exe`. Esse é o único arquivo que precisa ir para o PC da loja (via pendrive, por exemplo). Ao rodar esse instalador no PC de destino, o programa se instala sozinho e já abre automaticamente — inclusive a cada vez que o Windows ligar.

Os dados (vídeos, promoções, senha, tokens do Spotify) ficam salvos em `%APPDATA%\365-tv\data` no PC onde o programa está instalado — sobrevivem a reinstalações/atualizações do programa.

## Acessando o Painel Administrativo

De qualquer outro computador **na mesma rede Wi-Fi/cabo da loja**, abra no navegador:

```
http://<IP-do-PC-da-TV>:3450/admin
```

(Para descobrir o IP do PC da TV, rode `ipconfig` nele e veja o "Endereço IPv4".)

**Senha padrão:** `365motos` — troque assim que possível na seção "Senha do painel" dentro do próprio painel.

## Configurações que dependem de você

### Clima (OpenWeatherMap)

1. Crie uma conta gratuita em https://openweathermap.org/api e gere uma API key.
2. No painel, em **Widgets → Clima**, informe a cidade (ex: `Sarandi,BR`) e cole a API key.

Se a internet cair, o widget mostra o último valor conhecido em vez de sumir.

### Música (Spotify)

> ⚠️ **Aviso de licenciamento**: uma conta Spotify pessoal (mesmo Premium) é licenciada para uso pessoal, não comercial. Usá-la como trilha sonora de um estabelecimento comercial viola os Termos de Uso do Spotify. Essa integração foi implementada a pedido, com essa ressalva conhecida — a alternativa sem esse risco é um serviço de streaming licenciado para uso comercial (ex: Soundtrack Your Brand). O módulo de música (`server/music/`) foi desenhado com uma interface plugável, então trocar de provedor no futuro não exige redesenhar o resto do sistema.

Pré-requisitos para usar o Spotify:

1. Ter uma conta **Spotify Premium** ativa.
2. Ter o **app Spotify Desktop instalado e logado** no PC ligado à TV (ele será o "dispositivo" de saída de áudio).
3. Criar um app em https://developer.spotify.com/dashboard para obter o **Client ID**.
4. Nas configurações do app no dashboard do Spotify (botão "Edit Settings"), cadastrar exatamente este Redirect URI:
   ```
   http://127.0.0.1:3450/spotify/callback
   ```
   O Spotify só aceita links de retorno `https://` ou o endereço `127.0.0.1` — um IP de rede local (ex: `192.168.x.x`) é recusado como "inseguro". Por isso **a etapa de autorizar o Spotify precisa ser feita usando um navegador aberto diretamente no PC da TV** (não dá para fazer essa etapa específica de outro computador da rede).
5. No PC da TV: cole o Client ID no campo do painel (pode acessar via `http://localhost:3450/admin` nesse mesmo PC) e clique em **Conectar Spotify** — uma aba abre para você logar e autorizar.
6. Depois de conectado, selecione o dispositivo (deve aparecer o Spotify Desktop do PC da loja) na lista.

Isso é necessário **só nessa etapa única de autorização**. Depois de conectado, o dia a dia (tocar/pausar/trocar música/volume) funciona normalmente pelo painel de qualquer computador da rede — só a autorização inicial exige estar fisicamente no PC da TV (ou usar uma conexão de área de trabalho remota até ele).

Se o Spotify cair (app fechado, sem internet, token expirado), o restante do sistema (vídeo, promoção, relógio) continua funcionando normalmente — o widget de música só mostra "desconectado".

### Inicialização automática com o Windows

O app se registra sozinho para abrir automaticamente ao ligar o Windows (via `app.setLoginItemSettings`). Isso já funciona a partir da instalação gerada por `npm run dist` — não funciona rodando via `npm start` em modo desenvolvimento.

## Estrutura do projeto

```
main.js              processo principal do Electron (janela kiosk + boot do servidor)
server/              API REST + Socket.IO + estado persistido em data/state.json
  routes/            endpoints do painel (videos, promo, widgets, music, auth)
  music/             provedor de música plugável (spotify-provider.js implementa o Spotify)
player/              tela exibida na TV (HTML/CSS/JS puro, conecta via Socket.IO)
admin/               painel administrativo (HTML/CSS/JS puro, protegido por senha)
data/                gerado em runtime: state.json, secrets.json (tokens), media/ (uploads)
```

## Limitações da primeira versão (MVP)

Ainda não incluído (previsto para depois, conforme o documento de especificação):
agendamento por dia/horário, múltiplos layouts de tela, QR Codes, gerenciamento pela internet (fora da rede local), múltiplas TVs.
