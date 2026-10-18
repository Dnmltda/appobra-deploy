import json, sys, urllib.request, urllib.error

B = "http://127.0.0.1:8097"
results = []


def call(method, path, token=None, body=None):
    req = urllib.request.Request(B + path, method=method)
    req.add_header("content-type", "application/json")
    if token:
        req.add_header("Authorization", token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt else {})
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, {"raw": txt}


def login(ident, pw="Senha12345"):
    s, r = call("POST", "/api/collections/users/auth-with-password", body={"identity": ident, "password": pw})
    assert s == 200, (ident, s, r)
    return r["token"], r["record"]


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("OK   " if ok else "FALHA") + " | " + name + (" | " + detail if detail else ""))


def err(r):
    d = r.get("data") or {}
    return (r.get("message", "") + " " + json.dumps(d, ensure_ascii=False))[:200]


tA, uA = login("a@teste.local")
tB, uB = login("b@teste.local")
cA, cB = uA["company_id"], uB["company_id"]
print("role admin A:", uA.get("role"), "cargo:", uA.get("cargo"))

# --- Isolamento: companies / users
s, r = call("GET", "/api/collections/companies/records?perPage=50", tA)
names = [x["name"] for x in r.get("items", [])]
check("Empresa A NAO enxerga dados de outras empresas (companies)", "Empresa B" not in names, f"A ve: {names}")

s, r = call("GET", "/api/collections/users/records?perPage=50", tA)
emails = [x.get("email") or x.get("username") for x in r.get("items", [])]
check("Empresa A NAO lista usuarios da B", "adminb" not in json.dumps(r), f"A ve {len(r.get('items', []))} usuarios")

s, r = call("POST", "/api/collections/users/records", tA, {
    "email": "intruso@teste.local", "username": "intruso", "password": "Senha12345", "passwordConfirm": "Senha12345",
    "company_id": cB, "role": "Administrador", "cargo": "Administrador", "status": "Ativo", "id_unico": "99"})
check("Admin A NAO consegue criar usuario dentro da empresa B", s >= 400, f"status {s} {err(r) if s>=400 else 'criado id ' + r.get('id','')}")

# --- Funcionario comum da empresa A
s, r = call("POST", "/api/collections/users/records", tA, {
    "email": "func@teste.local", "username": "funca", "password": "Senha12345", "passwordConfirm": "Senha12345",
    "company_id": cA, "role": "Funcionário", "cargo": "Funcionário", "status": "Ativo", "id_unico": "02", "name": "Func A"})
check("Admin A cria funcionario na propria empresa", s == 200, f"status {s} {err(r) if s>=400 else ''}")
tF, uF = login("func@teste.local")

s, r = call("PATCH", f"/api/collections/users/records/{uF['id']}", tF, {"role": "Administrador", "cargo": "Administrador"})
check("Funcionario NAO consegue se promover a Administrador", s >= 400 or r.get("role") != "Administrador",
      f"status {s} role agora={r.get('role')} cargo={r.get('cargo')}")

s, r = call("PATCH", f"/api/collections/users/records/{uF['id']}", tF, {"company_id": cB})
check("Funcionario NAO consegue se mover para a empresa B", s >= 400 or r.get("company_id") != cB,
      f"status {s} company_id agora={'B' if r.get('company_id') == cB else 'A'}")
# volta para A (como superuser seria o certo; aqui usa o proprio token se tiver mudado)
call("PATCH", f"/api/collections/users/records/{uF['id']}", tF, {"company_id": cA, "role": "Funcionário", "cargo": "Funcionário"})

# --- Fluxo estoque
s, obra = call("POST", "/api/collections/obras/records", tA, {"nome": "Obra Teste A", "status": "Em Andamento", "company_id": cA})
check("Admin A cria obra", s == 200, err(obra) if s >= 400 else "")
s, mats = call("GET", "/api/collections/materiais/records?perPage=1&filter=" + urllib.parse.quote(f'company_id="{cA}"'), tA)
check("Empresa nova ja nasce com catalogo de materiais", mats.get("totalItems", 0) > 0, f"{mats.get('totalItems')} materiais")
mat = mats["items"][0] if mats.get("items") else None
if mat:
    q0 = mat.get("quantity_in_stock") or 0
    s, mv = call("POST", "/api/collections/movimentacoes/records", tA, {
        "material_id": mat["id"], "obra_id": obra.get("id"), "company_id": cA, "tipo": "Entrada", "type": "entrada",
        "quantidade": 10, "status": "Finalizado", "data": "2026-10-18 12:00:00.000Z"})
    check("Admin A registra movimentacao de Entrada", s == 200, err(mv) if s >= 400 else "")
    s, m2 = call("GET", f"/api/collections/materiais/records/{mat['id']}", tA)
    check("Saldo do material muda pelo servidor apos Entrada (+10)", (m2.get("quantity_in_stock") or 0) == q0 + 10,
          f"antes {q0} depois {m2.get('quantity_in_stock')}")
    s, mv2 = call("POST", "/api/collections/movimentacoes/records", tA, {
        "material_id": mat["id"], "company_id": cA, "tipo": "Saída", "type": "saida", "quantidade": 999999, "status": "Finalizado"})
    check("Servidor recusa Saida maior que o saldo", s >= 400, f"status {s}" + ("" if s >= 400 else " (aceitou saida de 999999)"))
    if s == 200:
        s, r = call("PATCH", f"/api/collections/movimentacoes/records/{mv2['id']}", tA, {"quantidade": 1})
        check("Movimentacao registrada NAO pode ser editada (historico imutavel)", s >= 400, f"status {s}")
    s, r = call("DELETE", f"/api/collections/materiais/records/{mat['id']}", tA)
    check("Admin A consegue inativar/excluir material (regra de delete)", s < 400, f"status {s} {err(r) if s>=400 else 'EXCLUIDO de verdade (hard delete)'}")

# --- Solicitacao
s, sol = call("POST", "/api/collections/solicitacoes/records", tA, {
    "company_id": cA, "numero_solicitacao": "SOL-T1", "tipo": "Material", "categoria": "Elétrica", "solicitante_id": uA["id"],
    "prioridade": "Normal", "descricao": "teste", "status": "Aberta", "data_solicitacao": "2026-10-18 12:00:00.000Z"})
check("Admin A cria solicitacao", s == 200, err(sol) if s >= 400 else "")
if s == 200:
    s, r = call("PATCH", f"/api/collections/solicitacoes/records/{sol['id']}", tA, {"status": "Aprovada"})
    check("Admin A (role Administrador) consegue aprovar solicitacao", s == 200, f"status {s} {err(r) if s>=400 else ''}")
    s, r = call("POST", "/api/collections/solicitacoes/records", tF, {
        "company_id": cA, "numero_solicitacao": "SOL-T2", "tipo": "Material", "solicitante_id": uF["id"], "descricao": "func", "status": "Aberta"})
    check("Funcionario cria solicitacao", s == 200, err(r) if s >= 400 else "")
    s, r = call("PATCH", f"/api/collections/solicitacoes/records/{sol['id']}", tF, {"status": "Aprovada"})
    check("Funcionario NAO aprova solicitacao", s >= 400, f"status {s}")

# --- Colecoes sem company_id: B le/apaga dados da A?
for col, body in [
    ("pedidos_compra", None), ("perdas_ganhos", {"tipo": "Quebra", "item_nome": "Betoneira A", "quantidade": 1}),
    ("veiculos", {"id_unico": "V1", "placa": "AAA0A00", "marca": "Ford", "modelo": "Cargo"}),
    ("contas_pagar", {"descricao": "Conta da A", "valor": 1000, "data_vencimento": "2026-11-01 12:00:00.000Z"}),
    ("auditoria", None), ("equipes", {"id_unico": "E1", "nome": "Equipe A"}),
    ("documentos_central", {"nome": "Contrato A"}),
]:
    if body:
        s, rec = call("POST", f"/api/collections/{col}/records", tA, body)
        if s >= 400:
            check(f"[{col}] A cria registro", False, err(rec)); continue
    s, r = call("GET", f"/api/collections/{col}/records?perPage=50", tB)
    n = r.get("totalItems", 0)
    check(f"[{col}] Empresa B NAO ve registros da A", n == 0, f"B ve {n} registro(s)")
    if body and n:
        s, r2 = call("DELETE", f"/api/collections/{col}/records/{rec['id']}", tB)
        check(f"[{col}] Empresa B NAO apaga registro da A", s >= 400, f"status {s}")

s, r = call("GET", "/api/collections/auditoria/records?perPage=1", tB)
if r.get("items"):
    s, r2 = call("DELETE", f"/api/collections/auditoria/records/{r['items'][0]['id']}", tB)
    check("Log de auditoria NAO pode ser apagado por usuario comum", s >= 400, f"status {s}")

s, r = call("POST", "/api/collections/audit_logs/records", None, {"acao": "falso", "modulo": "x"})
check("Visitante sem login NAO grava em audit_logs", s >= 400, f"status {s}")

print("\nRESUMO:", sum(1 for x in results if x[1]), "OK /", sum(1 for x in results if not x[1]), "FALHA")
json.dump(results, open(sys.argv[1], "w"), ensure_ascii=False, indent=1)
