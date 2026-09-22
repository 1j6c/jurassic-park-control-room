# Provenance

Jurassic Park: System Control was created by 1j6c (github.com/1j6c), September 22, 2026.

The MIT license lets you do anything with this code, including selling it. It asks for one thing: keep the license file, which has a name on it. This page exists for the day someone forgets. Nothing here restricts you. It just makes the origin impossible to argue with.

Three layers, from the oldest technique to the newest.

## 1. A signed statement (Ed25519)

The sentence above is signed with an Ed25519 key that only the author holds. The key is not on GitHub, not in any browser, not in this repository. Anyone can verify the signature. Nobody else can produce a new one.

Public key (DER, base64):

    MCowBQYDK2VwAyEA2wvQnmJewplacogglZ9PLTPHK3Yaoz9RfdM9t7XCUSQ=

Signature (base64):

    29VSCxGLRdyD87HNWwdPsWQQKR9W+jJEmebFg/qHPVpL4dbWnOuV1oMFX7f4DmsjlaosKjviikY4vJ1BSInEAA==

```bash
printf '%s' "Jurassic Park: System Control was created by 1j6c (github.com/1j6c), September 22, 2026." > s.txt
{ echo "-----BEGIN PUBLIC KEY-----"; echo "MCowBQYDK2VwAyEA2wvQnmJewplacogglZ9PLTPHK3Yaoz9RfdM9t7XCUSQ="; echo "-----END PUBLIC KEY-----"; } > pub.pem
echo "29VSCxGLRdyD87HNWwdPsWQQKR9W+jJEmebFg/qHPVpL4dbWnOuV1oMFX7f4DmsjlaosKjviikY4vJ1BSInEAA==" | base64 -d > s.sig
openssl pkeyutl -verify -pubin -inkey pub.pem -rawin -in s.txt -sigfile s.sig
```

Prints `Signature Verified Successfully`. Typing `verify` in the game's console shows the same data. If you ever need to know whether a message really comes from the author, ask for it signed with this key.

## 2. Signed commits and tags (SSH, Ed25519)

Every commit and every release tag in this repository is signed with this SSH key, registered on the GitHub account 1j6c. GitHub shows them as **Verified**.

    ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILUMMAT7m8m9PgZJc3ngRMpBEWvnFaZnzhtcTSCi6M0v

The two keys vouch for each other. The author key above signed this sentence:

    ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILUMMAT7m8m9PgZJc3ngRMpBEWvnFaZnzhtcTSCi6M0v is 1j6c's git signing key

Signature (base64):

    1b3+IgLgZc/Ofn07eGaYCldCykwaDCuwnoNN9QCjHSjgzcH9OCZjmMpeq0FyvrrnI8galQW3fgqe7bKQANuVBw==

To check a commit locally: `git log --show-signature`, with the SSH key in your `allowedSignersFile`.

## 3. Release attestations (Sigstore) and timestamps (Bitcoin)

Each tagged release is built by GitHub Actions and comes with a build provenance attestation: a Sigstore-signed record, logged in the public Rekor transparency log, that ties the release archive to this exact repository, commit and workflow. Verify with the GitHub CLI:

```bash
gh attestation verify jurassic-park-control-room-v1.0.0.zip --owner 1j6c
```

`docs/provenance/` also holds OpenTimestamps proofs (`.ots`) for the release: the hash of the archive is anchored in the Bitcoin blockchain, which proves it existed on that date without trusting GitHub or anyone else. Verify with the `ots` client:

```bash
ots verify docs/provenance/v1.0.0.txt.ots
```

That's it. Use the code however you like. The receipt is just here.
