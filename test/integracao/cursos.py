"""CRUD de cursos e as relacoes, ATRAVES do frontend (proxy /api/backend).

Nao chama o NestJS direto: passa pelo cookie httpOnly e pelo proxy do Next, que
e o caminho que o navegador percorre. Exercita exatamente o que as telas de
Cursos, Disciplinas e Pessoas consomem, com os mesmos parametros.

Uso:  py -I test/integracao/cursos.py     (frontend em 3001, backend em 3000)

ATENCAO — BANCO DESCARTAVEL.

Como os demais scripts desta pasta, este CRIA dados: cursos, disciplinas e uma
conta de aluno (que recebe e-mail de verdade, com a senha gerada). Rode-o
apenas contra um banco de desenvolvimento, com os usuarios do seeder
(`npm run db:seed` no backend). Apontado para uma base com contas reais, ele
suja o catalogo e dispara e-mail para um endereco inventado.
"""

import json
import time
import urllib.request
import urllib.error

BASE = 'http://localhost:3001'
API = BASE + '/api/backend'

ok = 0
falhas = []


def chamar(metodo, url, cookie=None, corpo=None):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(url, data=dados, method=metodo)
    req.add_header('Content-Type', 'application/json')
    if cookie:
        req.add_header('Cookie', cookie)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            texto = r.read().decode()
            return r.status, (json.loads(texto) if texto else None)
    except urllib.error.HTTPError as e:
        texto = e.read().decode()
        return e.code, (json.loads(texto) if texto else None)


def verificar(descricao, condicao, detalhe=''):
    global ok
    if condicao:
        ok += 1
        print(f'  OK    {descricao} {detalhe}')
    else:
        falhas.append(descricao)
        print(f'  FALHA {descricao} {detalhe}')


def entrar(email):
    dados = json.dumps({'email': email, 'senha': 'senhaSegura123'}).encode()
    req = urllib.request.Request(BASE + '/api/bff/login', data=dados, method='POST')
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.headers.get('Set-Cookie', '').split(';')[0]


sufixo = str(int(time.time()))[-6:]

print('\n== Sessoes ==')
prof = entrar('joao.ribeiro@ufx.edu.br')
alu = entrar('ana.martins@ufx.edu.br')
verificar('login do professor', bool(prof))
verificar('login da aluna', bool(alu))

# ------------------------------------------------------------------ CRUD

print('\n== CRUD de curso ==')
st, curso = chamar('POST', API + '/cursos', prof, {'nome': f'Engenharia Teste {sufixo}'})
verificar('professor cria curso', st == 201, f'({st})')
verificar('codigo e gerado pelo servidor', bool(curso and curso.get('codigo')),
          f"({curso.get('codigo') if curso else '-'})")
verificar('nasce ativo', curso and curso.get('ativo') is True)
cid = curso['id']

st, recusado = chamar('POST', API + '/cursos', prof,
                      {'nome': f'Com codigo {sufixo}', 'codigo': 'XXX999'})
verificar('enviar `codigo` e recusado com 400', st == 400, f'({st})')

st, _ = chamar('POST', API + '/cursos', prof, {'nome': 'A'})
verificar('nome curto demais e recusado com 400', st == 400, f'({st})')

st, pelaAluna = chamar('POST', API + '/cursos', alu, {'nome': f'Aluna tentando {sufixo}'})
verificar('aluno NAO cria curso (403)', st == 403, f'({st})')

st, lista = chamar('GET', f'{API}/cursos?busca=Engenharia Teste {sufixo}', prof)
verificar('busca encontra o curso criado',
          st == 200 and any(c['id'] == cid for c in lista['dados']), f'({st})')

st, detalhe = chamar('GET', f'{API}/cursos/{cid}', alu)
verificar('leitura liberada a aluno autenticado', st == 200, f'({st})')

st, renomeado = chamar('PATCH', f'{API}/cursos/{cid}', prof,
                       {'nome': f'Engenharia Renomeada {sufixo}'})
verificar('professor renomeia', st == 200 and renomeado['nome'].startswith('Engenharia Renomeada'))
verificar('o codigo NAO muda ao renomear', renomeado['codigo'] == curso['codigo'],
          f"({renomeado['codigo']})")

st, _ = chamar('PATCH', f'{API}/cursos/{cid}', alu, {'nome': 'Aluna tentando'})
verificar('aluno NAO edita curso (403)', st == 403, f'({st})')

st, _ = chamar('DELETE', f'{API}/cursos/{cid}', prof)
verificar('nao existe DELETE (RN10)', st in (404, 405), f'({st})')

st, desativado = chamar('PATCH', f'{API}/cursos/{cid}', prof, {'ativo': False})
verificar('desativar e o caminho para tirar de circulacao',
          st == 200 and desativado['ativo'] is False)

st, ativos = chamar('GET', f'{API}/cursos?ativo=true&limite=100', prof)
verificar('curso inativo sai do filtro de ativos',
          all(c['id'] != cid for c in ativos['dados']))

chamar('PATCH', f'{API}/cursos/{cid}', prof, {'ativo': True})

# --------------------------------------------------- N:N com disciplina

print('\n== Relacao N:N com disciplina ==')
st, outro = chamar('POST', API + '/cursos', prof, {'nome': f'Sistemas Teste {sufixo}'})
cid2 = outro['id']

st, semCursos = chamar('POST', API + '/disciplinas', prof, {'nome': f'Sem curso {sufixo}'})
verificar('disciplina SEM cursosIds e recusada com 400', st == 400, f'({st})')

st, disc = chamar('POST', API + '/disciplinas', prof,
                  {'nome': f'Banco de Dados {sufixo}', 'cursosIds': [cid, cid2]})
verificar('cria disciplina com dois cursos', st == 201, f'({st})')
verificar('resposta traz os cursos vinculados',
          disc and len(disc.get('cursos', [])) == 2, f"({len(disc.get('cursos', [])) if disc else 0})")
verificar('cada curso vem com id, codigo e nome',
          all(all(k in c for k in ('id', 'codigo', 'nome')) for c in disc['cursos']))
did = disc['id']

st, listaDisc = chamar('GET', f'{API}/disciplinas?busca=Banco de Dados {sufixo}', prof)
daLista = next((d for d in listaDisc['dados'] if d['id'] == did), None)
verificar('a LISTAGEM tambem traz os cursos (a tela os exibe ali)',
          daLista is not None and len(daLista.get('cursos', [])) == 2,
          f"({len(daLista.get('cursos', [])) if daLista else 0})")

st, reduzida = chamar('PATCH', f'{API}/disciplinas/{did}', prof, {'cursosIds': [cid]})
verificar('cursosIds SUBSTITUI o conjunto', st == 200 and len(reduzida['cursos']) == 1,
          f"({len(reduzida['cursos']) if st == 200 else st})")

st, semNenhum = chamar('PATCH', f'{API}/disciplinas/{did}', prof, {'cursosIds': []})
verificar('lista vazia de cursos e recusada com 400', st == 400, f'({st})')

st, soNome = chamar('PATCH', f'{API}/disciplinas/{did}', prof, {'nome': f'BD renomeado {sufixo}'})
verificar('omitir cursosIds NAO mexe nos cursos',
          st == 200 and len(soNome['cursos']) == 1, f"({len(soNome['cursos']) if st == 200 else st})")

# ------------------------------------------------------- 1:N com aluno

print('\n== Relacao 1:N com aluno ==')
st, semCurso = chamar('POST', API + '/alunos', prof,
                      {'nome': f'Sem curso {sufixo}', 'email': f'sc{sufixo}@ufx.edu.br',
                       'matricula': f'SC{sufixo}'})
verificar('aluno SEM cursoId e recusado com 400', st == 400, f'({st})')

st, comTexto = chamar('POST', API + '/alunos', prof,
                      {'nome': f'Texto livre {sufixo}', 'email': f'tl{sufixo}@ufx.edu.br',
                       'matricula': f'TL{sufixo}', 'curso': 'Engenharia'})
verificar('o antigo `curso` em texto livre e recusado com 400', st == 400, f'({st})')

st, aluno = chamar('POST', API + '/alunos', prof,
                   {'nome': f'Carla Curso {sufixo}', 'email': f'cc{sufixo}@ufx.edu.br',
                    'matricula': f'CC{sufixo}', 'cursoId': cid})
verificar('cria aluno com cursoId', st == 201, f'({st})')
verificar('resposta traz cursoId e o NOME do curso',
          aluno and aluno['aluno'].get('cursoId') == cid and aluno['aluno'].get('curso'),
          f"({aluno['aluno'].get('curso') if aluno else '-'})")

st, buscados = chamar('GET', f'{API}/alunos?busca=Carla Curso {sufixo}', prof)
encontrado = next((a for a in buscados['dados'] if a['id'] == aluno['id']), None)
verificar('a listagem de alunos tambem traz o nome do curso',
          encontrado is not None and bool(encontrado['aluno'].get('curso')),
          f"({encontrado['aluno'].get('curso') if encontrado else '-'})")

st, _ = chamar('POST', API + '/alunos', prof,
               {'nome': f'Curso inexistente {sufixo}', 'email': f'ci{sufixo}@ufx.edu.br',
                'matricula': f'CI{sufixo}', 'cursoId': '00000000-0000-4000-8000-000000000000'})
verificar('cursoId inexistente e recusado', st in (400, 404, 409), f'({st})')

# ---------------------------------------------------------------------------

print(f'\n{"=" * 60}')
print(f'{ok} verificacoes OK, {len(falhas)} falhas')
for f in falhas:
    print(f'  - {f}')
print('=' * 60)
