# Deploying to Cloudflare Pages (redbyteapps.dev)

These steps reproduce the deployment workflow that merges the latest development work into `main` and triggers the Cloudflare Pages build for **redbyteapps.dev**.

1. Ensure your local repo is up to date:
   ```bash
   git checkout development
   git pull
   ```
2. Merge development into main with a merge commit:
   ```bash
   git checkout main
   git pull
   git merge --no-ff development -m "Deploy v1.0.0 — Legal Protections + Advanced Snap System + Tiling System"
   ```
3. Push the merge to the remote:
   ```bash
   git push origin main
   ```
4. Cloudflare Pages will automatically rebuild. Monitor the deployment logs in the Cloudflare dashboard for **redbyteapps.dev** and verify:
   - The desktop footer shows `© 2025 Connor Angiel — RedByte OS Genesis` and `All rights reserved.`
   - Apps load correctly, including snapping and quadrant tiling.
   - Settings > About & Legal displays version **v1.0.0**, copyright, trademarks, the expandable LICENSE text, and `Created by: Connor Angiel`.

If deployment logs show errors, fix them on `main`, push again, and re-check the Cloudflare Pages deployment.
