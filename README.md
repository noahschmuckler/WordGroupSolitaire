# Word Groups Solitaire

A calm word-sorting solitaire: put category cards into the slots, then gather each category's words onto them. Words with double meanings (*Orange*, *Bass*, *Mercury*…) can go to any category that fits, as long as the deal can still be finished.

No move limits, no ads, no purchases. Unlimited undo and deck recycling. Progress is saved in your browser.

Everything lives in `public/`: plain HTML/CSS/JS with no build step. To add categories, edit `public/words.js`.

## Run locally
    cd public && python3 -m http.server 8000

## Deploy (Cloudflare Pages)
    npx wrangler pages deploy public --project-name word-groups-solitaire
