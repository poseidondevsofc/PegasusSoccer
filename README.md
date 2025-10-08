Pegasus Soccer - Final Package

Arquivos na raiz:
- index.html
- style.css
- game.js
- README.md

Como publicar:
1. Coloque os arquivos na raiz do repositório GitHub.
2. Ative GitHub Pages (Settings → Pages → Branch: main, root).
3. Acesse: https://<username>.github.io/<repo>/

Cheats por tecla (seguro):
- Token secreto (não compartilhe): bb30490eb73240408a4736cc4c775f7c
- Para ativar silenciosamente (uma vez no seu notebook), abra o console (F12) e rode:
    localStorage.setItem('pegasus_dev_token', 'bb30490eb73240408a4736cc4c775f7c');
- Após isso, pressione a tecla '1' para **congelar o adversário por 30s**.
- Pressione '2' para **parar o tempo por 10s**.
- Pressione '3' para **alternar** o modo de cheats.
- Pressione '4' para **ver status** no console.

Alternativa (console):
- Você também pode ativar com:
    window.__pegasusActivate('bb30490eb73240408a4736cc4c775f7c');
- E executar cheats com:
    window.__pegasusCheat('freezeOpponent', 30);
    window.__pegasusCheat('stopTime', 10);

Segurança:
- As teclas só executam cheats se o token estiver presente em localStorage **ou** se cheats foram ativados via window.__pegasusActivate(token).
- Se quiser que qualquer pessoa possa apertar '1' e ativar cheats (não recomendado), abra `game.js` e ajuste `DEV_CHEAT_ALWAYS = true`.
