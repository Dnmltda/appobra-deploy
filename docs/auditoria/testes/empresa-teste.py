"""Empresa de teste do Diego: "Construtora Teste DNM (não apagar)", com um login por cargo.

Uso (de fora do repositório; as senhas NUNCA vão para o git):
  python3 -I empresa-teste.py criar    <URL do servidor> <arquivo de senhas>
  python3 -I empresa-teste.py conferir <URL do servidor> <arquivo de senhas> [<arquivo de senhas da outra empresa>]

- criar: cadastra a empresa (o primeiro login vira o Administrador) e cria os outros logins com senhas fortes
  geradas na hora. Grava login e senha só no arquivo indicado (fora do repositório) e mostra a tabela na tela.
- conferir: entra com cada login e confere que entra, que as telas principais respondem sem erro e que nenhum
  registro de outra empresa aparece (isolamento por empresa). Com o arquivo de outra empresa, confere também
  que uma não vê nada da outra, nos dois sentidos.

Os e-mails usam o domínio reservado ".invalid": o servidor não envia e-mail para eles (pb_hooks/titular.pb.js).
O nome da empresa termina com "(não apagar)": a limpeza de testes nunca a apaga (pb_hooks/limpeza-testes.pb.js).
"""
import json
import secrets
import string
import sys
import urllib.error
import urllib.request

EMPRESA = "Construtora Teste DNM (não apagar)"
DOMINIO = "teste-appobra.invalid"
# Um login para cada cargo que o app aceita (users.cargo). O primeiro é quem cadastra a empresa.
CARGOS = [
    ("Administrador", "administrador"), ("Gerência", "gerencia"), ("Engenheiro", "engenheiro"),
    ("Mestre de Obras", "mestre"), ("Almoxarife", "almoxarife"), ("Comprador", "comprador"),
    ("Financeiro", "financeiro"), ("RH", "rh"), ("Funcionário", "funcionario"), ("Cliente", "cliente"),
    ("Pedreiro", "pedreiro"), ("Servente", "servente"), ("Encanador", "encanador"),
    ("Eletricista", "eletricista"), ("Faxina", "faxina"),
]
# Tabelas conferidas no isolamento (a pessoa só pode ver a própria empresa).
TABELAS = ["companies", "users", "funcionarios", "obras", "materiais", "movimentacoes", "solicitacoes", "compras",
           "equipamentos", "epis", "fornecedores", "ocorrencias", "estoque_obra", "saldo_funcionario", "emprestimos",
           "epis_entregas", "qrcode_leituras", "notificacoes", "obra_mensagens"]


def call(base, method, path, token=None, body=None):
    req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"content-type": "application/json", **({"Authorization": token} if token else {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            t = r.read().decode()
            return r.status, json.loads(t) if t else {}
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try:
            return e.code, json.loads(t)
        except Exception:
            return e.code, {"raw": t}


def senha():
    simbolos = "!@#%*-_"
    while True:
        s = "".join(secrets.choice(string.ascii_letters + string.digits + simbolos) for _ in range(16))
        if any(c.isupper() for c in s) and any(c.islower() for c in s) and any(c.isdigit() for c in s) and any(c in simbolos for c in s):
            return s


def ler(arq):
    return [l.rstrip("\n").split("\t") for l in open(arq, encoding="utf-8") if l.strip() and not l.startswith("#")]


def criar(base, arq):
    logins = []
    cargo0, nome0 = CARGOS[0]
    email0, s0 = f"{nome0}@{DOMINIO}", senha()
    st, r = call(base, "POST", "/api/custom/self-register-company", body={
        "companyName": EMPRESA, "adminName": f"Teste {cargo0}", "adminEmail": email0, "username": f"teste.{nome0}", "password": s0})
    if st != 200:
        sys.exit(f"Não consegui cadastrar a empresa: {st} {r}")
    st, a = call(base, "POST", "/api/collections/users/auth-with-password", body={"identity": email0, "password": s0})
    if st != 200:
        sys.exit(f"O administrador de teste não entrou: {st} {a}")
    tok, cid = a["token"], a["record"]["company_id"]
    logins.append((cargo0, email0, f"teste.{nome0}", s0))
    for cargo, nome in CARGOS[1:]:
        email, s = f"{nome}@{DOMINIO}", senha()
        st, r = call(base, "POST", "/api/collections/users/records", tok, {
            "email": email, "username": f"teste.{nome}", "password": s, "passwordConfirm": s, "name": f"Teste {cargo}",
            "company_id": cid, "cargo": cargo, "role": cargo, "status": "Ativo"})
        if st != 200:
            print(f"FALHA ao criar {email}: {st} {r.get('message')}")
            continue
        logins.append((cargo, email, f"teste.{nome}", s))
    with open(arq, "w", encoding="utf-8") as f:
        f.write(f"# {EMPRESA} — {base}\n# cargo\te-mail\tusuário\tsenha\n")
        for l in logins:
            f.write("\t".join(l) + "\n")
    for cargo, email, user, s in logins:
        print(f"{cargo:16} {email:40} {user:22} {s}")


def conferir(base, arq, outro=None):
    ok = falha = 0
    empresas = {}
    for cargo, email, _user, s in ler(arq):
        st, a = call(base, "POST", "/api/collections/users/auth-with-password", body={"identity": email, "password": s})
        if st != 200:
            print(f"FALHA {cargo}: não entrou ({st})"); falha += 1; continue
        tok, cid = a["token"], a["record"]["company_id"]
        empresas[cid] = tok
        erros = []
        for t in TABELAS:
            st, r = call(base, "GET", f"/api/collections/{t}/records?perPage=200", tok)
            if st >= 500:
                erros.append(f"{t}: erro {st}")
            elif st == 200:
                fora = [x for x in r.get("items", []) if (x.get("company_id") or (x.get("id") if t == "companies" else cid)) != cid]
                if fora:
                    erros.append(f"{t}: vê {len(fora)} registro(s) de outra empresa")
        if erros:
            print(f"FALHA {cargo}: " + "; ".join(erros)); falha += 1
        else:
            print(f"OK    {cargo}: entra e só vê a própria empresa"); ok += 1
    if outro:
        for cargo, email, _u, s in ler(outro)[:1]:
            st, a = call(base, "POST", "/api/collections/users/auth-with-password", body={"identity": email, "password": s})
            if st == 200:
                cid2, tok2 = a["record"]["company_id"], a["token"]
                for cid, tok in list(empresas.items())[:1]:
                    for t in TABELAS:
                        for (de, para, tk) in ((cid, cid2, tok), (cid2, cid, tok2)):
                            st, r = call(base, "GET", f"/api/collections/{t}/records?perPage=1&filter=" +
                                         urllib.request.quote(f'company_id="{para}"' if t != "companies" else f'id="{para}"'), tk)
                            if st == 200 and r.get("totalItems"):
                                print(f"FALHA isolamento: empresa {de} vê {t} da empresa {para}"); falha += 1
                print(f"OK    isolamento conferido entre as duas empresas ({len(TABELAS)} tabelas, nos dois sentidos)"); ok += 1
    print(f"\nRESUMO: {ok} OK / {falha} FALHA")


if __name__ == "__main__":
    if len(sys.argv) < 4 or sys.argv[1] not in ("criar", "conferir"):
        sys.exit(__doc__)
    if sys.argv[1] == "criar":
        criar(sys.argv[2].rstrip("/"), sys.argv[3])
    else:
        conferir(sys.argv[2].rstrip("/"), sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
