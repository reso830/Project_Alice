# Compatibility Scoring

How Alice turns a profile and a job description into the **compatibility score** (0–100) and band shown on every application.

This is a reader-facing explainer written in plain language and formulas. The score is **deterministic** — the same profile and job always produce the same number — and is computed entirely on your own structured data, with **no AI and no network calls**. AI may help *extract* a job description elsewhere in Alice, but it never decides this score.

> Scope note: the score is meant to be **informative, not authoritative** — a quick read on broad fit, not a prediction of whether you'll be hired.

---

## 1. The shape of the score

A job is compared to a profile across **five categories**. Each category produces a sub-score between $0$ and $1$. The categories are combined into a single percentage and mapped to a label.

| Category | Default weight | What it measures |
|---|---:|---|
| Skills | **43** | How well your skills (and how strongly) cover the job's skills |
| Role alignment | **25** | How closely the job title matches your roles and summary |
| Experience | **12** | Whether your years of experience meet the job's stated minimum |
| Keywords | **10** | General overlap of vocabulary between the posting and your profile |
| Certifications | **10** | Whether your certifications appear in the posting |

Skills carries the most weight because it is the only signal that is *structured on both sides* (the job lists skills; your profile lists skills with proficiency). Experience is deliberately light: it rests on a single coarse number that most postings don't even state.

The weights are **defaults**, not laws — they are configurable, and any category that has nothing to compare is dropped and the rest rebalanced (see §7).

---

## 2. Notation

Throughout, let:

- $C$ — the set of skills in your profile, each with a proficiency level $\ell \in \{1,2,3,4,5\}$.
- A matched skill contributes its **proficiency fraction** $\dfrac{\ell}{5}\in\{0.2,\dots,1.0\}$ — an expert (5) counts fully, a beginner (1) counts a fifth.
- For any piece of text, its **significant words** are its words lowercased, with spacing normalised, with very common filler words removed, and duplicates collapsed. $|X|$ is the number of items in a set $X$.

---

## 3. Skills

This is the most important category, so it is also the most carefully shaped.

The job lists **required** skills $R$ and **preferred** ("nice to have") skills $P$. A preferred skill counts for less than a required one — specifically it carries a weight of

$$w = 0.69$$

chosen so that *a preferred skill at proficiency 4 carries about the same as a required skill at proficiency 2.75*.

The skills sub-score is a single **pooled, weighted coverage** fraction. Skills you have contribute their proficiency fraction; skills you lack contribute nothing but still count against you in the denominator:

$$
\text{skills} \;=\;
\frac{\displaystyle\sum_{s\,\in\,R\cap C}\frac{\ell_s}{5}\;+\;w\sum_{s\,\in\,P\cap C}\frac{\ell_s}{5}}
{\,|R|\;+\;w\,|P|\,}
$$

Two guards complete it:

- **No required skills matched.** If the job lists required skills but you match *none* of them, the sub-score is capped:
$$\text{skills}\;=\;\min\!\big(0.35,\ \text{skills}\big)$$
so strong nice-to-haves can never disguise the fact that you fail the actual requirements.

- **A posting with no required skills.** If the job lists only preferred skills, the $w$ in numerator and denominator cancels and the formula naturally becomes plain coverage of the preferred list — which can reach $100\%$ if you have them all. If the job lists no skills at all, the category is dropped (§7).

### Why it behaves well

- **A required match always counts at least as much as the same skill listed as preferred.** Because required carries the full weight and preferred only $0.69$, moving a skill from preferred to required can only help — there is no way for a "nice to have" to out-score a true requirement.
- **Misses always count.** A skill you lack stays in the denominator, so matching five of six strong requirements lands near $\tfrac{5}{6}$, not $100\%$. Only a *complete and expert* match reaches the top.

### Worked example

A job requires 6 skills; you have 5 of them at proficiency 4 (so each contributes $0.8$), and no preferred skills are involved:

$$
\text{skills}=\frac{5\times 0.8}{6}=\frac{4.0}{6}\approx 0.67
$$

Two things hold you under $1.0$: the one requirement you miss (it stays in the denominator) and the fact that "strong" (4) is not "expert" (5). Matching all six at expert level would give $\tfrac{6}{6}=1.0$.

---

## 4. Role alignment

Let $T$ be the significant words of the **job title**, and $G$ the significant words of your **past role titles together with your summary**. The sub-score is how much of the title your background echoes:

$$
\text{role}=\frac{|\,T\cap G\,|}{|\,T\,|}
$$

If the job has no title, or your profile offers no roles or summary, the category is dropped.

---

## 5. Experience

A job may state a **minimum number of years**, $y_{\text{req}}$ (the "Min Years" field; most postings leave it blank). Your **years of experience** $y_{\text{cand}}$ are added up from your work history — for each job, the time from its start to its end, using *today* for a job you still hold:

$$
y_{\text{cand}}=\sum_{\text{jobs}}\big(\text{end date}-\text{start date}\big)\ \text{in years}
$$

When a minimum is stated, experience is graded by how close you come, and meeting it is enough (there is no bonus for being wildly over-qualified):

$$
\text{experience}=
\begin{cases}
1 & y_{\text{cand}}\ \ge\ y_{\text{req}}\\[4pt]
\dfrac{y_{\text{cand}}}{y_{\text{req}}} & y_{\text{cand}}\ <\ y_{\text{req}}
\end{cases}
$$

So a near-miss scores higher than a large shortfall.

### When the job states a minimum but your profile shows no work history

This is treated by *what your profile contains*, so that an unfinished profile is not punished for missing data:

- **You have other profile content** (a summary, education, skills, certifications, awards, or languages) but no work history → experience scores **$0$**. This is a genuine "no experience yet" signal — e.g. a fresh graduate facing a years requirement.
- **Your profile is essentially empty** (no work history *and* nothing else) → the category is **dropped** and the others rebalance (§7). There is simply nothing to assess.

If the job states no minimum at all (the common case), experience is dropped regardless.

---

## 6. Keywords and certifications

**Keywords** is a coarse vocabulary overlap. Let $J$ be the significant words of the posting (its responsibilities, title, and listed skills) and $F$ the significant words of your profile (summary, the descriptions of your past work, and your skill names):

$$
\text{keywords}=\frac{|\,J\cap F\,|}{|\,J\,|}
$$

It is bounded between $0$ and $1$ by construction, so a long, keyword-stuffed posting cannot dominate.

**Certifications.** Each of your certifications is reduced to its significant words. A certification is considered "mentioned" if most of its words (at least $60\%$) appear in the posting's text. The sub-score is the share of your certifications that are mentioned:

$$
\text{certifications}=\frac{\#\{\text{your certifications mentioned in the posting}\}}{\#\{\text{your certifications}\}}
$$

If you list no certifications, or the posting has no text, the category is dropped.

---

## 7. Combining the categories

Only categories that have something to compare on **both** sides are "active." The final score is the weighted average of the active categories' sub-scores, with the active weights **rebalanced to add up to the whole** — so a dropped category never silently drags the result up or down:

$$
S = 100 \times \frac{\displaystyle\sum_{c\,\in\,\text{active}} \omega_c\cdot \text{score}_c}{\displaystyle\sum_{c\,\in\,\text{active}} \omega_c}
$$

where $\omega_c$ is the weight of category $c$. If no category is active, the score is $0$.

This rebalancing is why setting "Min Years" can move the total noticeably: a blank minimum drops experience and rebalances the other four; stating a minimum brings experience (weight $12$) back into the average.

---

## 8. From score to label

The final score is rounded to a whole number, kept within $0$–$100$, and shown with a band label. The label is always derived from the number, so the two can never disagree.

| Score | Label |
|---|---|
| 0 – 39 | Low |
| 40 – 64 | Medium |
| 65 – 84 | High |
| 85 – 100 | Great |

The bands are deliberately conservative — "Great" is hard to reach — to keep the score honest.

---

## 9. What this score is not

- It is **not** a prediction of being hired, interviewed, or shortlisted.
- It does **not** use AI, the internet, or any data beyond your profile and the job description in front of you.
- It does **not** read meaning into words — matching is exact on significant words, so close variants ("React" vs "React.js") are treated as different. This is a deliberate trade for determinism and honesty over false precision.

---

*See also: the feature specification and decision log under `specs/036-compatibility-engine/` (the formulas here mirror research decisions D10/D11 and the data-model revision history).*
