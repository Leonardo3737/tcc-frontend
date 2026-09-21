"""Fluxo completo do dominio, exercitado ATRAVES do frontend (proxy /api/backend).

Nao chama o NestJS direto: passa pelo cookie httpOnly e pelo proxy do Next, que
e exatamente o caminho que o navegador percorre.
"""

import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

# A maquina de teste esta em UTC-4 e a instituicao em UTC-3. Montar o instante
# com o fuso do sistema produziria horarios fora da disponibilidade — que e
# exatamente a armadilha que o frontend evita com instanteDeDataHoraLocal().
FUSO = timezone(timedelta(hours=-3))  # America/Sao_Paulo (sem DST desde 2019)


def instante(base, hora):
    """Instante UTC correspondente a `hora` LOCAL da instituicao."""
    local = base.replace(hour=hora, minute=0, second=0, microsecond=0, tzinfo=FUSO)
    return local.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')

BASE = 'http://localhost:3001'
API = BASE + '/api/backend'

ok = 0
falhas = []


def chamar(metodo, url, cookie=None, corpo=None, esperado=(200, 201)):
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
        print(f'  OK   {descricao} {detalhe}')
    else:
        falhas.append(descricao)
        print(f'  FALHA {descricao} {detalhe}')


def entrar(email):
    dados = json.dumps({'email': email, 'senha': 'senhaSegura123'}).encode()
    req = urllib.request.Request(BASE + '/api/bff/login', data=dados, method='POST')
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=60) as r:
        bruto = r.headers.get('Set-Cookie', '')
        return bruto.split(';')[0]


sufixo = str(int(time.time()))[-6:]

print('\n== Sessoes ==')
prof = entrar('joao.ribeiro@ufx.edu.br')
alu = entrar('ana.martins@ufx.edu.br')
verificar('login do professor', bool(prof))
verificar('login da aluna', bool(alu))

print('\n== Disciplina e monitoria (professor) ==')
st, disc = chamar('POST', API + '/disciplinas', prof,
                  {'codigo': f'FE{sufixo}', 'nome': f'Frontend E2E {sufixo}'})
verificar('cria disciplina', st == 201, f'({st})')

st, mon = chamar('POST', API + '/monitorias', prof,
                 {'disciplinaId': disc['id'], 'ano': 2026, 'semestre': 2,
                  'descricao': 'Monitoria de verificacao do frontend'})
verificar('cria monitoria', st == 201 and mon['status'] == 'PLANEJADA', f"({mon.get('status')})")
mid = mon['id']

st, ativa = chamar('POST', f'{API}/monitorias/{mid}/ativar', prof)
verificar('ativa monitoria', ativa and ativa['status'] == 'ATIVA')

print('\n== Participantes (RN01) ==')
st, part = chamar('POST', f'{API}/monitorias/{mid}/monitores', prof,
                  {'alunoId': '22222222-2222-4222-8222-222222222222'})
verificar('habilita aluna como MONITOR', st == 201 and part['papel'] == 'MONITOR')
vinculo = part['id']

st, dup = chamar('POST', f'{API}/monitorias/{mid}/monitorados', prof,
                 {'alunoId': '22222222-2222-4222-8222-222222222222'})
verificar('RN09: recusa acumulo de papeis', dup and dup.get('statusCode') == 409,
          f"({dup.get('statusCode')})")

st, busca = chamar('GET', f'{API}/alunos?busca=ana&semVinculoAtivoNaMonitoria={mid}', prof)
ids = [a['id'] for a in busca['dados']]
verificar('busca de alunos exclui quem ja participa',
          '22222222-2222-4222-8222-222222222222' not in ids)

print('\n== Contexto: o papel e por monitoria ==')
st, vista = chamar('GET', f'{API}/monitorias/{mid}', alu)
verificar('aluna ve meuPapel=MONITOR', vista['meuPapel'] == 'MONITOR', f"({vista['meuPapel']})")
verificar('meuParticipanteId e o id do VINCULO', vista['meuParticipanteId'] == vinculo)

st, visaoProf = chamar('GET', f'{API}/monitorias/{mid}', prof)
verificar('professor ve souResponsavel=true e meuPapel=None',
          visaoProf['souResponsavel'] is True and visaoProf['meuPapel'] is None)

print('\n== Disponibilidade e agendamento ==')
alvo = datetime.now() + timedelta(days=3)
dia_semana = (alvo.weekday() + 1) % 7  # python: 0=segunda; backend: 0=domingo

st, faixa = chamar('POST', f'{API}/monitorias/{mid}/disponibilidades', alu,
                   {'diaSemana': dia_semana, 'horaInicio': '08:00', 'horaFim': '20:00'})
verificar('monitora declara disponibilidade', st == 201, f"({faixa.get('diaSemanaNome')})")

# Instante em UTC correspondente a 14:00 local (America/Sao_Paulo = UTC-3).
inicio_iso = instante(alvo, 14)
fim_iso = instante(alvo, 15)

st, atend = chamar('POST', f'{API}/monitorias/{mid}/atendimentos', alu,
                   {'inicio': inicio_iso, 'fim': fim_iso, 'assunto': 'Sessao de verificacao',
                    'modalidade': 'REMOTO', 'local': 'https://meet.exemplo/e2e', 'vagas': 3})
verificar('monitora abre sessao', st == 201, f"({st} {atend.get('mensagem','')})")

if st == 201:
    aid = atend['id']
    verificar('origem = OFERTA_MONITOR', atend['origem'] == 'OFERTA_MONITOR')
    verificar('aceitaInscricao calculado no servidor', atend['aceitaInscricao'] is True)
    verificar('resumo da monitoria vem junto (sem N+1)',
              atend.get('monitoria', {}).get('codigoDisciplina') == f'FE{sufixo}')

    print('\n== Conflito de horario (RN03) ==')
    st2, conflito = chamar('POST', f'{API}/monitorias/{mid}/atendimentos', alu,
                           {'inicio': inicio_iso, 'fim': fim_iso, 'assunto': 'Sessao sobreposta',
                            'modalidade': 'REMOTO', 'vagas': 1})
    verificar('recusa sobreposicao do monitor', conflito.get('statusCode') == 409,
              f"({conflito.get('statusCode')})")

    print('\n== Fora da disponibilidade ==')
    st3, foraResp = chamar('POST', f'{API}/monitorias/{mid}/atendimentos', alu,
                           {'inicio': instante(alvo, 6), 'fim': instante(alvo, 7),
                            'assunto': 'Fora da faixa', 'modalidade': 'REMOTO'})
    verificar('recusa horario fora da disponibilidade', foraResp.get('statusCode') == 409,
              f"({foraResp.get('statusCode')})")

    print('\n== Reagendamento ==')
    st4, reag = chamar('POST', f'{API}/atendimentos/{aid}/reagendar', alu,
                       {'inicio': instante(alvo, 16), 'fim': instante(alvo, 17),
                        'motivo': 'Ajuste na verificacao do frontend'})
    verificar('reagenda mantendo AGENDADO', st4 == 200 and reag['status'] == 'AGENDADO', f'({st4})')

    st5, hist = chamar('GET', f'{API}/atendimentos/{aid}/historico', alu)
    verificar('RN10: reagendamento fica no historico', len(hist) >= 2, f'({len(hist)} eventos)')

    print('\n== Agenda pessoal ==')
    st6, meus = chamar('GET', f'{API}/atendimentos/meus?status=AGENDADO', alu)
    verificar('agenda da aluna inclui a sessao',
              any(a['id'] == aid for a in meus['dados']))

print('\n== Materiais (RN08) ==')
st, mat = chamar('POST', f'{API}/monitorias/{mid}/materiais', alu,
                 {'titulo': 'Lista de verificacao', 'url': 'https://exemplo.test/lista.pdf'})
verificar('monitora publica material', st == 201, f'({st})')

st, matProf = chamar('GET', f'{API}/monitorias/{mid}/materiais', prof)
verificar('professor responsavel ve o acervo', matProf['meta']['total'] >= 1)

print('\n== Indicadores ==')
st, ind = chamar('GET', f'{API}/analytics/monitorias/{mid}', prof)
verificar('indicadores da monitoria', st == 200 and ind['monitoresAtivos'] == 1,
          f"(monitores={ind.get('monitoresAtivos')})")

st, resumo = chamar('GET', '/'.join([API, 'analytics/resumo?apenasMinhas=true']), prof)
verificar('resumo da plataforma (professor)', st == 200 and resumo['monitorias']['total'] >= 1)

st, negado = chamar('GET', API + '/analytics/resumo', alu)
verificar('aluno barrado no resumo da plataforma', negado.get('statusCode') == 403,
          f"({negado.get('statusCode')})")

print('\n== Encerramento com atendimento AGENDADO ==')
st, enc = chamar('POST', f'{API}/monitorias/{mid}/encerrar', prof)
verificar('recusa encerrar com atendimento agendado', enc.get('statusCode') == 409,
          f"({enc.get('statusCode')})")

print(f'\n{"=" * 50}')
print(f'{ok} verificacoes OK, {len(falhas)} falha(s)')
for f in falhas:
    print(f'  - {f}')
