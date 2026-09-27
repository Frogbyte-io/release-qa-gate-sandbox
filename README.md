# Release QA gate sandbox

This public repository remains a disposable integration target for [Release QA](https://github.com/Frogbyte-io/release-qa). The original gate experiments and draft releases are kept for their historical evidence.

**Orbit Orchard** is a tiny packaged arcade game for the Task 3.1 candidate-preparation run. Collect the glowing star in each 30-second round; a three-star streak earns a bonus. The best score is stored by Electron in the app's user-data directory. The renderer cannot access Node directly.

```sh
npm ci
npm test
npm start
npm run package:windows # NSIS installer on Windows
npm run package:linux   # .deb on Linux
```

The `game-ci` workflow packages both platforms on pull requests and `main`. Those CI artifacts prove that distributables can be built; they are not yet selected Release QA candidates. Candidate preparation will use a separate trusted workflow, verify the exact packaged bytes, and select a candidate only after both files are staged and checked.
note
