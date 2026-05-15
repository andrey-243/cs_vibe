@PROJECT.md

---

⚠️ **Dev server** : killer et relancer après CHAQUE modif de code. HMR Turbopack ne reload pas systématiquement.

```bash
kill -9 $(ps aux | grep next-server | grep -v grep | awk '{print $2}') 2>/dev/null
sleep 2 && cd frontend && npm run dev > /tmp/nextjs-dev.log 2>&1 &
sleep 8 && tail -3 /tmp/nextjs-dev.log
```

Si tu as besoin de contexte sur le projet (stack, composants, pipeline, GRID API, design, mécanique de jeu), lis `PROJECT.md`.
