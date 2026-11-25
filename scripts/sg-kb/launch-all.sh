#!/bin/zsh
# usage: sg-launch-all.sh [--apply]
set -e
cd "$(dirname "$0")/../.."
R() { ./node_modules/.bin/tsx scripts/sg-property-launch.ts "$@" $EXTRA; }
EXTRA=$1
R --slug the-shattuck --name "The Shattuck" --appfolio-id 1645 --hosts theshattuck.com,www.theshattuck.com,the-shattuck.vercel.app --assistant Ivy --color "#7f5a53" --ga-property 565710220 --ga-id G-TE7FG8285X --gsc sc-domain:theshattuck.com
R --slug 1803-oxford --name "1803 Oxford" --appfolio-id 1354 --hosts 1803oxford.com,www.1803oxford.com,1803-oxford.vercel.app --assistant Owen --color "#9c4319" --ga-property 565678251 --ga-id G-MDFVFWJVTV --gsc sc-domain:1803oxford.com
R --slug stranda --name "Stranda" --appfolio-id 83 --hosts strandaberkeley.com,www.strandaberkeley.com,stranda.vercel.app --assistant Lena --color "#8a2a1c" --ga-property 565730158 --ga-id G-XLVW5NKT1L --gsc sc-domain:strandaberkeley.com
R --slug the-point --name "The Point" --appfolio-id 158 --hosts thepointrichmond.com,www.thepointrichmond.com,the-point-richmond.vercel.app --assistant Grace --color "#a3212a" --ga-property 565709560 --ga-id G-19W57H0G40 --gsc sc-domain:thepointrichmond.com
R --slug wesley-house --name "Wesley House" --appfolio-id 1353 --hosts wesley-house.vercel.app --assistant June --color "#1b357a"
R --slug rise-at-berkeley --name "RISE at Berkeley" --appfolio-id 730 --hosts rise-at-berkeley.vercel.app --assistant Leo --color "#1b2440"
R --slug the-mattox --name "The Mattox" --appfolio-id 727 --hosts the-mattox.vercel.app --assistant Eli --color "#3f5e49"
R --slug rumi-at-king --name "Rumi at King" --appfolio-id 732 --hosts rumi-at-king.vercel.app --assistant Zara --color "#0b5e60"
R --slug aquatic-at-u --name "Aquatic at U" --appfolio-id 783 --hosts aquatic-at-u.vercel.app --assistant Kai --color "#1f6a93"
R --slug aquatic-shattuck --name "Aquatic Shattuck" --appfolio-id 1100 --hosts aquatic-shattuck.vercel.app --assistant Mira --color "#0f6b66"
R --slug aquatic-higby --name "Aquatic Higby" --appfolio-id 2386 --hosts aquatic-higby.vercel.app --assistant Ben --color "#8a6212"
R --slug 2715-channing --name "2715 Channing" --appfolio-id 764 --hosts 2715-channing.vercel.app --assistant Clara --color "#1c2c5c"
