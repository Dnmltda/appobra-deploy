# Testes no navegador (Playwright)

Clicam nas telas como um usuário faria, contra o servidor LOCAL de teste (nunca produção).

Pré-requisitos (além do servidor local do `../README.md`, com as empresas A e B criadas):

```bash
# 1. Telas apontando para o servidor local
cd frontend && npm ci
VITE_POCKETBASE_URL=http://127.0.0.1:8097 npx vite build --outDir /tmp/front_dist
npx vite preview --outDir /tmp/front_dist --port 4173 &

# 2. Servidor de e-mail falso (captura os e-mails de recuperação de senha e "Fale conosco")
python3 docs/auditoria/testes/navegador/smtp_sink.py /tmp/emails 2525 &

# 3. Cada teste com banco novo (o teste altera os dados)
cd docs/auditoria/testes/navegador
SINK=/tmp/emails node login.mjs
```

Variáveis: `FRONT` (padrão http://127.0.0.1:4173), `API` (http://127.0.0.1:8097), `CHROME` (caminho do
Chromium), `PLAYWRIGHT_DIR` (pasta onde o pacote `playwright` está instalado).

| Arquivo | O que testa |
|---|---|
| `compra.mjs` | criar compra, item, recebimento → material entra no estoque |
| `estoque.mjs` | entrada, saída barrada/recusada, inventário, saldo travado no cadastro |
| `permissoes.mjs` | menu e rotas por cargo (Almoxarife, Gerência, Pedreiro, Administrador) |
| `login.mjs` | login por e-mail/usuário/ID, conta inativa, esqueci a senha com link real |
| `perfil-senha.mjs` | troca de senha pelo perfil |
| `honestidade.mjs` | "Fale conosco" envia e-mail, alerta de documento real, excluir = arquivar |
| `selecoes.mjs` | listas no lugar de texto livre (movimentações, perdas, contas a receber, equipamentos) |
| `ids-materiais.mjs` | estoque começa vazio, sugestão de material, ID por ordem de chegada (só leitura) |
| `convite.mjs` | convite de funcionário: e-mail com botão, link certo, cria a senha e entra |
| `equipamento.mjs` | emprestar equipamento, atraso, receber de volta com o estado (manutenção) |
| `divergencia.mjs` | conferir estoque: diferença com motivo, aguarda autorização, administrador autoriza |
| `ocorrencias.mjs` | ocorrência com foto e gravidade alta, e-mail para a chefia, resolver com o que foi feito |
| `estoque-minimo.mjs` | material chega no mínimo: painel, sininho, e-mail, pedir compra sem duplicar |
| `funcionario-acesso.mjs` | convite de funcionário: novo, recadastrado com o mesmo e-mail, criar acesso/reenviar convite na edição; ID automático (sem campo, quem volta recupera o número, gente nova não pega número de quem saiu) |
| `convite-esqueci.mjs` | convite pendente + "Esqueci minha senha": reenvia o convite, ativa e entra; excluído não reativa |
| `usuario.mjs` | aba ID aceita "1", aba Usuário sem diferenciar maiúscula, pessoa troca o próprio usuário no perfil |
| `login-limite.mjs` | 5 senhas erradas travam a conta por 15 min e a tela explica o que fazer |
| `epi-estoque.mjs` | entrega de EPI pela tela, assinada e com a foto de quem recebe: o servidor baixa o estoque; maior que o saldo é recusada; ficha de EPI (cautela) em PDF |
| `fluxo-material.mjs` | pedido de material: pedir → estoque confirma que recebeu → separa → pronto para retirada → quem pediu recusa (material errado) ou aceita com a foto de quem leva (baixa no estoque, vai para o saldo dele) → registra o uso na obra → Materiais por Obra |
| `estoque-obra.mjs` | estoque geral + estoque por obra: transferir do geral, consumir e devolver na tela Estoque por Obra; pedido de material separado do estoque da obra; gasto em Materiais por Obra |
| `materiais-cor.mjs` | cadastro de material por lista: categoria, cor (fio nas cores da norma) e marca; código sempre gerado pelo servidor (ELE-001, ELE-002), mesmo fio em duas cores, troca de cor na edição |
| `acesso-estoque.mjs` | servente vê só o próprio material (Meu Material), não cadastra material, não vê quantidade, movimentações nem estoque das obras; almoxarife vê tudo; busca de material pronto no cadastro |
| `obra-mural.mjs` | página da obra: Minha Obra do pedreiro, mural só para quem está na obra, aviso no sininho, recado vazio recusado, foto da obra, Tirar da obra / Colocar na obra |
| `equipamento-repasse.mjs` | passar o equipamento para outra pessoa na obra: só quem está com ele (ou a gestão) vê o botão; para quem, onde estão e foto da troca; o equipamento fica com a nova pessoa, no local informado |
| `codigo-barras.mjs` | código de barras da embalagem (EAN-13 desenhado na câmera de teste): Registrar Entrada escolhe o material sozinho; a tela QR Code abre o material |
| `qrcode.mjs` | QR Code: etiqueta de um item real gerada no aparelho (sem site de fora), link do QR abre o item, leitura registrada por empresa, outra empresa não vê, leitura de verdade pela câmera (precisa de `FRONTEND_DIR` apontando para `frontend/`, para gerar a imagem da câmera de teste) |

A câmera dos testes é a câmera de teste do Chromium (`--use-fake-device-for-media-stream`): a foto da retirada
(material, EPI e equipamento) é tirada por ela (`tirarFoto` em `lib.mjs`).
