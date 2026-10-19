// Limite de trocas de senha pela própria pessoa: no máximo LIMITE por
// JANELA_DIAS (usado por login-e-senha.pb.js). Módulo à parte porque cada
// handler do JSVM roda isolado.
//
// Conta: cada "Esqueci minha senha" que sai por e-mail (inclui o convite
// reenviado) e cada troca pelo perfil. NÃO conta: o administrador trocando a
// senha de outra pessoa (é o caminho para quem ficou sem tentativas) e o
// "Criar minha senha" do convite.
//
// As datas ficam em users.trocas_senha (texto oculto, separado por vírgula):
// campo oculto não sai nas respostas da API nem pode ser gravado por ela.

const LIMITE = 2;
const JANELA_DIAS = 7;
const CAMPO = "trocas_senha";

function recentes(u) {
  const desde = Date.now() - JANELA_DIAS * 86400000;
  return String(u.get(CAMPO) || "").split(",")
    .map((s) => s.trim())
    .filter((s) => s && new Date(s).getTime() >= desde)
    .sort();
}

function podeTrocar(u) {
  return recentes(u).length < LIMITE;
}

// Grava a troca de agora no registro (quem chama salva o registro).
function registrar(u) {
  const lista = recentes(u);
  lista.push(new Date().toISOString());
  u.set(CAMPO, lista.join(","));
}

// "dd/mm" do dia em que libera a próxima troca (horário de Brasília).
function liberaEm(u) {
  const lista = recentes(u);
  if (!lista.length) return "";
  const d = new Date(new Date(lista[0]).getTime() + JANELA_DIAS * 86400000 - 3 * 3600000);
  return String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0");
}

module.exports = { LIMITE, JANELA_DIAS, CAMPO, podeTrocar, registrar, liberaEm };
