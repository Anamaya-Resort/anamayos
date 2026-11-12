"""
SEED THE SOCIAL DASHBOARD WITH SAMPLE DATA.

    python3 -I scripts/seed-social-sample.py

Safe to re-run: it deletes the previous sample account and rebuilds from
a fixed random seed, so the same command always produces the same year.
It only ever touches rows flagged is_sample = true, so a real connected
account is never affected.

Generates one year of realistic sample Instagram data for the AnamayOS
social dashboard, so the charts and layout can be checked before a read
token exists.

Everything written here carries is_sample = true. The dashboard reads
that flag and shows a banner, because a realistic-looking chart is
exactly the sort of thing that gets screenshotted into a meeting six
months later.

Realism that matters for the charts to be worth looking at:
  - format drives reach and the non-follower share, not luck
  - carousels and educational subjects save; pretty places get shared
  - seasonality: a January wellness spike and a Sep-Nov booking season
  - a lifetime decay curve per post, snapshotted daily, so the maturity
    window and the campaign windows have something real to slice
  - one biohacking campaign that genuinely outperforms its own baseline,
    so panel 5 has a true answer rather than noise
"""
import json, math, random, re, urllib.request, datetime as dt

random.seed(20261112)

env = open('/Users/geoffreymccabe/AnamayOS/.env.local').read()
SU = re.search(r'NEXT_PUBLIC_SUPABASE_URL=(\S+)', env).group(1)
SK = re.search(r'SUPABASE_SERVICE_ROLE_KEY=(\S+)', env).group(1)
H = {'apikey': SK, 'Authorization': 'Bearer ' + SK,
     'Content-Type': 'application/json', 'Prefer': 'return=representation'}

def post(table, rows, upsert=None):
    if not rows: return []
    out = []
    for i in range(0, len(rows), 500):
        chunk = rows[i:i+500]
        h = dict(H)
        if upsert: h['Prefer'] = 'return=representation,resolution=merge-duplicates'
        req = urllib.request.Request(
            f'{SU}/rest/v1/{table}' + (f'?on_conflict={upsert}' if upsert else ''),
            data=json.dumps(chunk).encode(), headers=h, method='POST')
        try:
            out += json.load(urllib.request.urlopen(req))
        except urllib.error.HTTPError as e:
            raise SystemExit(f'{table} insert failed: {e.code} {e.read()[:500]}')
    return out

def get(table, query):
    req = urllib.request.Request(f'{SU}/rest/v1/{table}?{query}', headers=H)
    return json.load(urllib.request.urlopen(req))

def delete(table, query):
    req = urllib.request.Request(f'{SU}/rest/v1/{table}?{query}',
                                 headers=H, method='DELETE')
    urllib.request.urlopen(req)

# ---------------------------------------------------------------- account
delete('social_accounts', 'platform=eq.instagram&is_sample=is.true')
account = post('social_accounts', [{
    'platform': 'instagram',
    'external_id': 'sample-17841400689317448',
    'handle': 'anamayaresort',
    'label': 'Anamaya (sample data)',
    'timezone': 'America/Costa_Rica',
    'is_active': True,
    'is_sample': True,
}])[0]
ACC = account['id']
print('account', ACC)

pillars = {p['slug']: p for p in get('content_pillars', 'select=id,slug,name')}

# ---------------------------------------------------------- content model
# share   = how often this pillar is posted
# save/shr/eng/nfr = multipliers against the format baseline
PILLAR_MODEL = {
    'yoga':                  dict(share=0.30, save=1.00, shr=1.00, eng=1.05, nfr=1.00),
    'yoga-teacher-training': dict(share=0.14, save=1.45, shr=0.80, eng=0.90, nfr=0.80),
    'ecolodge-adventure':    dict(share=0.21, save=0.85, shr=1.55, eng=1.00, nfr=1.35),
    'wellness':             dict(share=0.20, save=1.30, shr=1.05, eng=1.10, nfr=1.05),
    'biohacking':           dict(share=0.10, save=1.70, shr=1.35, eng=1.15, nfr=1.20),
    'unclassified':         dict(share=0.05, save=0.75, shr=0.75, eng=0.80, nfr=0.85),
}
# reach_rate is against follower count; nfr is the non-follower share
FORMAT_MODEL = {
    'reel':     dict(share=0.45, reach=1.55, nfr=0.64, save=0.009, shr=0.011, eng=0.052, watch=(5.5, 14.0)),
    'carousel': dict(share=0.25, reach=0.74, nfr=0.30, save=0.019, shr=0.006, eng=0.061, watch=None),
    'image':    dict(share=0.22, reach=0.52, nfr=0.19, save=0.007, shr=0.004, eng=0.044, watch=None),
    'story':    dict(share=0.08, reach=0.26, nfr=0.05, save=0.001, shr=0.003, eng=0.021, watch=None),
}

CAPTIONS = {
    'yoga': [
        'Morning flow on the open-air deck, 6:30am, nothing between you and the Pacific.',
        'Hip openers after a week of hiking. Your body will thank you by Thursday.',
        'Three breaths before you get out of bed. That is the whole practice some days.',
        'Sunrise salutations with the howler monkeys providing the soundtrack.',
        'Restorative Friday. Bolsters, blankets, and absolutely nowhere to be.',
        'What a 90-minute vinyasa looks like when the jungle is your studio wall.',
        'Balance is not something you have. It is something you practise falling out of.',
        'Yin tonight. Long holds, low light, cicadas.',
    ],
    'yoga-teacher-training': [
        '200hr graduates, class of October. Twenty-two new teachers heading home.',
        'What a day on our 200hr actually looks like, hour by hour.',
        'The anatomy module is the one nobody expects to love. Everybody loves it.',
        'Our 2027 teacher training dates are open. Four cohorts, twenty spaces each.',
        'Teaching practicum, week three. The first time you cue a room of your peers.',
        'Three things our graduates say they wish they had known before signing up.',
        'Why we cap every training at twenty. It is not a marketing decision.',
    ],
    'ecolodge-adventure': [
        'The waterfall hike is 40 minutes up and worth every single step.',
        'Sunset from the ridge. No filter, no edit, just November light.',
        'We counted eleven species of bird before breakfast. Here are four of them.',
        'Montezuma to Santa Teresa the long way round, by boat.',
        'Our treehouse casitas, from the inside. Built around the trees, not through them.',
        'Horseback along the beach at low tide. Yes, it is as good as it looks.',
        'Zip line through the canopy, 400 metres, roughly 90 seconds of pure noise.',
        'Why our lodge has no air conditioning and nobody has ever asked for it.',
    ],
    'wellness': [
        'Cacao ceremony under the full moon. Bring a journal, leave your phone.',
        'The four-hour sleep protocol our guests ask about most.',
        'Sound bath in the yoga shala. Forty minutes, forty-two singing bowls.',
        'Cold plunge then sauna then ocean. In that order, for a reason.',
        'What we actually put in the green juice, and why.',
        'Breathwork at altitude. Short session, long effects.',
        'Our spa menu for the season, and which treatment to book on which day.',
        'Digital detox week: what guests report on day two versus day six.',
    ],
    'biohacking': [
        'Red light therapy before a 6am practice. The data on why it works.',
        'We tested HRV across forty guests over seven days. The results surprised us.',
        'Grounding: standing barefoot on wet sand for twenty minutes. What it does.',
        'Cold exposure and brown fat, explained without the jargon.',
        'Circadian light at the equator. Why twelve hours of daylight resets you faster.',
        'Continuous glucose monitoring on a plant-forward retreat menu. Seven days of data.',
        'Breath-hold training for surfers. Four weeks, measured.',
        'The three supplements our practitioners actually recommend, and the eight they do not.',
    ],
    'unclassified': [
        'Team photo, end of season. Thank you to every one of you.',
        'We are hiring a front-of-house lead for 2027.',
        'Closed for maintenance 12 to 19 September. Back better.',
        'A note of thanks to the guests who came back for the fourth time.',
    ],
}
TAGS = {
    'yoga': ['#yogaretreat', '#vinyasa', '#yinyoga', '#costaricayoga'],
    'yoga-teacher-training': ['#yogateachertraining', '#200hrytt', '#ryt200'],
    'ecolodge-adventure': ['#ecolodge', '#costarica', '#puravida', '#santateresa'],
    'wellness': ['#wellnessretreat', '#breathwork', '#soundbath'],
    'biohacking': ['#biohacking', '#hrv', '#coldplunge', '#redlighttherapy'],
    'unclassified': ['#anamaya'],
}

def weighted(model):
    keys = list(model)
    return random.choices(keys, [model[k]['share'] for k in keys])[0]

def seasonal(d):
    """New-year wellness spike, a quiet May-June, booking season Sep-Nov."""
    m = d.month
    base = {1: 1.30, 2: 1.12, 3: 1.05, 4: 0.98, 5: 0.86, 6: 0.84,
            7: 0.95, 8: 1.00, 9: 1.14, 10: 1.22, 11: 1.26, 12: 1.08}[m]
    return base * random.uniform(0.9, 1.1)

START = dt.date(2025, 11, 12)
END = dt.date(2026, 11, 12)

# The biohacking push, so panel 5 has a real answer.
CAMPAIGN_WINDOW = (dt.date(2026, 6, 1), dt.date(2026, 6, 30))

followers = 8200
follower_by_day = {}
d = START
while d <= END:
    growth = seasonal(d) * random.uniform(0.6, 1.5)
    followers += int(growth * 13)
    follower_by_day[d] = followers
    d += dt.timedelta(days=1)
print('followers', follower_by_day[START], '->', follower_by_day[END])

# ------------------------------------------------------------------ posts
posts, metrics = [], []
pid_seq = 0
d = START
while d <= END:
    # about five posts a week, with real gaps
    n = random.choices([0, 1, 1, 2], [0.22, 0.46, 0.46, 0.14])[0]
    for _ in range(n):
        pid_seq += 1
        in_campaign = CAMPAIGN_WINDOW[0] <= d <= CAMPAIGN_WINDOW[1]
        # During the push, biohacking is deliberately over-represented.
        if in_campaign and random.random() < 0.55:
            slug = 'biohacking'
        else:
            slug = weighted(PILLAR_MODEL)
        fmt = weighted(FORMAT_MODEL)
        if slug == 'biohacking' and random.random() < 0.45:
            fmt = 'carousel'   # the educational format for the subject

        pm, fm = PILLAR_MODEL[slug], FORMAT_MODEL[fmt]
        fol = follower_by_day[d]
        season = seasonal(d)

        hour = random.choices([6, 7, 8, 9, 12, 13, 17, 18, 19, 20],
                              [6, 10, 11, 7, 6, 5, 9, 11, 8, 4])[0]
        published = dt.datetime(d.year, d.month, d.day, hour,
                                random.randint(0, 59), tzinfo=dt.timezone.utc)
        # stored UTC; the account's timezone is Costa Rica (UTC-6)
        published = published + dt.timedelta(hours=6)

        # the occasional genuine outlier, because real feeds have them
        viral = random.random() < 0.035
        reach = int(fol * fm['reach'] * pm['nfr'] * season
                    * random.uniform(0.62, 1.45) * (3.6 if viral else 1.0))
        reach = max(reach, 120)
        nfr_share = min(0.93, fm['nfr'] * pm['nfr'] * random.uniform(0.85, 1.18)
                        * (1.25 if viral else 1.0))
        non_follower = int(reach * nfr_share)
        views = int(reach * random.uniform(1.08, 1.75) * (1.3 if fmt == 'reel' else 1.0))

        boost = 1.28 if in_campaign and slug == 'biohacking' else 1.0
        eng_rate = fm['eng'] * pm['eng'] * random.uniform(0.7, 1.35) * boost
        save_rate = fm['save'] * pm['save'] * random.uniform(0.65, 1.45) * boost
        share_rate = fm['shr'] * pm['shr'] * random.uniform(0.65, 1.45) * boost

        saves = int(reach * save_rate)
        shares = int(reach * share_rate)
        total_eng = int(reach * eng_rate)
        likes = max(0, int((total_eng - saves - shares) * random.uniform(0.86, 0.94)))
        comments = max(0, total_eng - saves - shares - likes)
        profile_visits = int(reach * random.uniform(0.006, 0.028)
                             * (1.4 if slug == 'yoga-teacher-training' else 1.0))
        follows = int(profile_visits * random.uniform(0.07, 0.22))
        link_clicks = int(profile_visits * random.uniform(0.10, 0.32))
        watch = (round(random.uniform(*fm['watch']), 2) if fm['watch'] else None)

        caption = random.choice(CAPTIONS[slug])
        posts.append({
            '_slug': slug,
            '_lifetime': dict(views=views, reach=reach, non_follower_reach=non_follower,
                              likes=likes, comments=comments, saves=saves, shares=shares,
                              follows=follows, profile_visits=profile_visits,
                              link_clicks=link_clicks, watch=watch),
            'account_id': ACC,
            'platform': 'instagram',
            'external_id': f'sample_{pid_seq:05d}',
            'permalink': f'https://www.instagram.com/p/SAMPLE{pid_seq:05d}/',
            'format': fmt,
            'published_at': published.isoformat(),
            'caption': caption,
            'thumbnail_url': None,
            'hashtags': random.sample(TAGS[slug], k=min(3, len(TAGS[slug]))),
            'is_sample': True,
        })
    d += dt.timedelta(days=1)

print('posts', len(posts))
payload = [{k: v for k, v in p.items() if not k.startswith('_')} for p in posts]
created = post('social_posts', payload)
by_ext = {c['external_id']: c['id'] for c in created}

# ------------------------------------------------- pillars + daily curves
# A post gathers most of its life in the first three days, then trickles.
# This curve is what makes the 7-day maturity window and the campaign
# slicing mean anything.
CURVE = [0.42, 0.24, 0.11, 0.06, 0.035, 0.026, 0.021] + \
        [0.016, 0.013, 0.011, 0.009, 0.008, 0.007, 0.006] + \
        [0.005] * 7 + [0.004] * 7
CURVE = [c / sum(CURVE) for c in CURVE]
TODAY = dt.date(2026, 11, 12)

links = []
for p in posts:
    post_id = by_ext[p['external_id']]
    slug = p['_slug']
    links.append({'post_id': post_id, 'pillar_id': pillars[slug]['id'],
                  'is_primary': True,
                  'confidence': None if slug == 'unclassified'
                                else round(random.uniform(0.62, 0.99), 3),
                  'source': 'manual' if random.random() < 0.12 else 'auto'})
    # A teacher-training post is also a yoga post. Multi-tagging, honestly.
    if slug == 'yoga-teacher-training':
        links.append({'post_id': post_id, 'pillar_id': pillars['yoga']['id'],
                      'is_primary': False, 'confidence': 0.9, 'source': 'auto'})
    if slug == 'biohacking' and random.random() < 0.4:
        links.append({'post_id': post_id, 'pillar_id': pillars['wellness']['id'],
                      'is_primary': False, 'confidence': 0.8, 'source': 'auto'})

    life = p['_lifetime']
    pub = dt.datetime.fromisoformat(p['published_at']).date()
    running = {k: 0 for k in
               ('views', 'reach', 'non_follower_reach', 'likes', 'comments',
                'saves', 'shares', 'follows', 'profile_visits', 'link_clicks')}
    for off, frac in enumerate(CURVE):
        day = pub + dt.timedelta(days=off)
        if day > TODAY: break
        row = {'post_id': post_id, 'metric_date': day.isoformat()}
        for k in running:
            # last day of the curve absorbs the rounding remainder
            v = (life[k] - running[k]) if off == len(CURVE) - 1 else int(life[k] * frac)
            v = max(0, v)
            running[k] += v
            row[k] = v
        row['video_avg_watch_seconds'] = life['watch']
        metrics.append(row)

post('post_pillars', links, upsert='post_id,pillar_id')
print('pillar links', len(links))
post('social_post_metrics_daily', metrics, upsert='post_id,metric_date')
print('post metric rows', len(metrics))

# ------------------------------------------------------- account per day
# Account reach deduplicates people across posts, so it is deliberately
# NOT the sum of post reach -- it is lower, which is what the real API
# returns and why the dashboard reads account rows for reach and views.
daily_posts = {}
for m in metrics:
    daily_posts.setdefault(m['metric_date'], []).append(m)

acct = []
d = START
while d <= END:
    key = d.isoformat()
    rows = daily_posts.get(key, [])
    raw_reach = sum(r['reach'] for r in rows)
    raw_views = sum(r['views'] for r in rows)
    overlap = random.uniform(0.62, 0.78)      # same people seeing several posts
    reach = int(raw_reach * overlap)
    fol = follower_by_day[d]
    follows = sum(r['follows'] for r in rows) + int(random.uniform(0, 4))
    unfollows = int(follows * random.uniform(0.18, 0.62)) + random.randint(0, 3)
    acct.append({
        'account_id': ACC, 'metric_date': key,
        'views': raw_views,
        'reach': reach,
        'non_follower_reach': int(sum(r['non_follower_reach'] for r in rows) * overlap),
        'accounts_engaged': int(sum(
            r['likes'] + r['comments'] + r['saves'] + r['shares'] for r in rows
        ) * random.uniform(0.72, 0.86)),
        'profile_visits': sum(r['profile_visits'] for r in rows) + random.randint(0, 9),
        'link_clicks': sum(r['link_clicks'] for r in rows) + random.randint(0, 3),
        'follows': follows, 'unfollows': unfollows, 'followers_total': fol,
    })
    d += dt.timedelta(days=1)
post('social_account_metrics_daily', acct, upsert='account_id,metric_date')
print('account day rows', len(acct))

# ---------------------------------------------------------- campaigns
delete('social_campaigns', 'is_sample=is.true')
camps = post('social_campaigns', [
    {'name': 'Biohacking June', 'slug': 'biohacking-june',
     'starts_on': '2026-06-01', 'ends_on': '2026-06-30',
     'goal_metric': 'saveRate', 'goal_value': 0.025, 'accent_slot': 7,
     'notes': 'A month focused on biohacking content to find out whether the subject '
              'pulls harder than our usual mix. Measured against the same pillars in May.',
     'is_sample': True},
    {'name': 'New Year Wellness', 'slug': 'new-year-wellness',
     'starts_on': '2026-01-02', 'ends_on': '2026-01-31',
     'goal_metric': 'engagementRate', 'goal_value': 0.07, 'accent_slot': 6,
     'notes': 'January intention-setting push across wellness and yoga.',
     'is_sample': True},
    {'name': 'YTT 2027 Launch', 'slug': 'ytt-2027-launch',
     'starts_on': '2026-09-15', 'ends_on': '2026-10-15',
     'goal_metric': 'profileVisitRate', 'goal_value': 0.02, 'accent_slot': 1,
     'notes': 'Opening the 2027 teacher training dates. Goal was profile visits and '
              'enquiries rather than reach.',
     'is_sample': True},
])
links2 = []
wiring = {'biohacking-june': ['biohacking'],
          'new-year-wellness': ['wellness', 'yoga'],
          'ytt-2027-launch': ['yoga-teacher-training']}
for c in camps:
    for s in wiring[c['slug']]:
        links2.append({'campaign_id': c['id'], 'pillar_id': pillars[s]['id']})
post('social_campaign_pillars', links2, upsert='campaign_id,pillar_id')
print('campaigns', len(camps), 'links', len(links2))
print('DONE')
