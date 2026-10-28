#!/usr/bin/env python3
"""
Génère chatbot/knowledge.md à partir de index.html (version française du site).

Le chatbot ne sait QUE ce qui est dans knowledge.md : après chaque mise à jour
du site, relancez ce script puis redéployez le Worker :

    python3 chatbot/build_knowledge.py
    cd chatbot && npx wrangler deploy

Pour donner au chatbot des informations absentes du site (disponibilités,
sujets de collaboration, encadrement…), écrivez-les dans chatbot/knowledge_extra.md :
le fichier est ajouté à la fin de knowledge.md s'il existe.

Aucune dépendance : bibliothèque standard Python uniquement.
"""
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "index.html"
EXTRA = Path(__file__).resolve().parent / "knowledge_extra.md"
OUT = Path(__file__).resolve().parent / "knowledge.md"

SKIP_TAGS = {"script", "style", "nav", "footer", "svg", "noscript", "head", "button"}
VOID = {"br", "img", "hr", "meta", "link", "input", "source", "wbr"}
BLOCK = {"p", "li", "dt", "dd", "h1", "h2", "h3", "h4", "summary", "blockquote", "div", "tr"}


class Extractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []        # (tag, skip)
        self.lines = []
        self.buf = ""
        self.link = None       # href du lien en cours
        self.link_text = ""

    # -- helpers
    def skipping(self):
        return any(s for _, s in self.stack)

    def flush(self, prefix=""):
        text = re.sub(r"\s+", " ", self.buf).strip()
        if text:
            self.lines.append(prefix + text)
        self.buf = ""

    # -- parser
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in VOID:
            if tag == "br" and not self.skipping():
                self.buf += " "
            return
        classes = (a.get("class") or "").split()
        skip = tag in SKIP_TAGS or "en" in classes or a.get("aria-hidden") == "true"
        self.stack.append((tag, skip))
        if self.skipping():
            return
        if tag in BLOCK:
            self.flush()
            if tag == "li":
                self.buf = "- "
            elif tag == "dt":
                self.buf = "**"
        elif self.link is None and self.buf.strip():
            # éléments en ligne collés (« Outils :PySparkPostgreSQL », « Email[…] »)
            if "chip" in classes and not self.buf.rstrip().endswith(":"):
                self.buf = self.buf.rstrip() + ", "
            elif not self.buf[-1].isspace():
                self.buf += " "
        if tag == "a" and a.get("href", "").startswith(("http", "mailto:", "doc/")):
            href = a["href"]
            if href.startswith("doc/"):
                href = "https://lamine.mlndao.fr/" + href
            self.link, self.link_text = href, ""

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        # dépile jusqu'à la balise correspondante (HTML tolérant)
        idx = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                idx = i
                break
        if idx is None:
            return
        was_skipping = self.skipping()
        del self.stack[idx:]
        if was_skipping and self.skipping():
            return
        if tag == "a" and self.link:
            label = re.sub(r"\s+", " ", self.link_text).strip()
            href = self.link
            self.link = None
            if label:
                # « Email », « DOI », « HAL »… : on garde le libellé et l'URL
                self.buf = self.buf[: len(self.buf) - len(self.link_text)] + f"[{label}]({href})"
            return
        if tag in ("h1", "h2", "h3", "h4"):
            level = {"h1": "# ", "h2": "## ", "h3": "### ", "h4": "#### "}[tag]
            text = re.sub(r"\s+", " ", self.buf).strip()
            if text:
                self.lines.append("")
                self.lines.append(level + text)
            self.buf = ""
        elif tag == "dt":
            self.buf = self.buf.rstrip() + "** :"
            self.flush()
        elif tag in BLOCK:
            self.flush()

    def handle_data(self, data):
        if self.skipping():
            return
        self.buf += data
        if self.link is not None:
            self.link_text += data


def build():
    html = SRC.read_text(encoding="utf-8")
    # On garde l'en-tête et le contenu principal ; on retire les commentaires HTML
    html = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    p = Extractor()
    p.feed(html)
    p.flush()

    # nettoyage : lignes vides multiples, puces vides, « dt » sans contenu
    out, prev_blank = [], True
    for line in p.lines:
        line = line.rstrip()
        if line in ("-", "- ", "****", "** :"):
            continue
        blank = not line.strip()
        if blank and prev_blank:
            continue
        # bloc Contact : « Affiliation » collé à sa valeur
        line = re.sub(r"^(Email|Affiliation|Profils)\s*(?=\S)", r"**\1** : ", line)
        # compteur de publications seul sous son titre : « ### Revues (2) »
        if line.strip().isdigit() and out and out[-1].startswith("### "):
            out[-1] += f" ({line.strip()})"
            continue
        out.append(line)
        prev_blank = blank

    body = "\n".join(out).strip()
    # le nom (h1) ouvre le profil
    body = body.replace("# Mouhamadou Lamine NDAO", "## Profil — Mouhamadou Lamine NDAO", 1)

    header = (
        "<!--\n"
        "  BASE DE CONNAISSANCES DU CHATBOT — générée automatiquement depuis index.html\n"
        "  par chatbot/build_knowledge.py. Ne pas éditer à la main : modifiez le site\n"
        "  (ou chatbot/knowledge_extra.md) puis relancez le script.\n"
        "-->\n\n"
        "Site : https://lamine.mlndao.fr\n\n"
    )
    text = header + body + "\n"
    if EXTRA.exists():
        text += "\n## Informations complémentaires\n" + EXTRA.read_text(encoding="utf-8").strip() + "\n"
    OUT.write_text(text, encoding="utf-8")
    words = len(re.findall(r"\w+", text))
    print(f"{OUT.relative_to(ROOT)} : {len(text):,} caractères, ~{words:,} mots".replace(",", " "))


if __name__ == "__main__":
    if not SRC.exists():
        sys.exit(f"index.html introuvable : {SRC}")
    build()
