import pandas as pd

df = pd.read_csv(r'C:\Users\bilal\OneDrive\Desktop\cric_oracle\cricket_features.csv')
counts = df['tournament'].value_counts()

LEAGUE_KEYWORDS = [
    'Indian Premier League', 'IPL',
    'Pakistan Super League', 'PSL',
    'Big Bash League', 'BBL',
    'Caribbean Premier League', 'CPL',
    'Bangladesh Premier League', 'BPL',
    'Vitality Blast', 'NatWest T20 Blast', 'T20 Blast',
    'The Hundred',
    'SA20',
    'International League T20', 'ILT20',
    'Lanka Premier League', 'LPL',
    'Major League Cricket', 'MLC',
    'Nepal Premier League',
    'Super Smash',
    'Ram Slam',
    'Mzansi Super League',
    'Global T20',
    'Abu Dhabi T10', 'T10 League',
    'Afghanistan Premier League', 'APL',
    'Gulf T20',
    'Euro T20 Slam',
    'Zimbabwe T20 Competition',
]

def classify_match_type(tournament):
    if not isinstance(tournament, str):
        return 'international'
    t_upper = tournament.upper()
    for kw in LEAGUE_KEYWORDS:
        if kw.upper() in t_upper:
            return 'league'
    return 'international'

print('=' * 70)
print('TOURNAMENT CLASSIFICATION REVIEW')
print('=' * 70)

league_rows = 0
intl_rows = 0

print()
print('-- LEAGUE ----------------------------------------------------------')
for t, c in counts.items():
    if classify_match_type(t) == 'league':
        print(f'  {c:>6}  {t}')
        league_rows += c

print()
print('-- INTERNATIONAL (top 60 by count) ----------------------------------')
intl_list = [(t, c) for t, c in counts.items() if classify_match_type(t) == 'international']
for t, c in sorted(intl_list, key=lambda x: -x[1])[:60]:
    print(f'  {c:>6}  {t}')

for t, c in intl_list:
    intl_rows += c

print()
print('=' * 70)
print(f'LEAGUE rows    : {league_rows:,}')
print(f'INTERNATIONAL  : {intl_rows:,}')
print(f'TOTAL          : {league_rows + intl_rows:,}')
print('=' * 70)
