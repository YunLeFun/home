# macOS release signing

Home 0.2.2 and CuteAC 0.4.2 use the same Developer ID Application certificate, team `QT792GAY4C`. Each app keeps its existing bundle identifier and HA Keychain service/account. The first upgrade from an ad-hoc build can still request “Always Allow”; subsequent builds retain the same designated requirement while this signing identity remains consistent. Signing does not replace Apple notarization, which is not part of this workflow.

Configure these in **both** `YunLeFun/home` and `YunYouJun/air-conditioner`:

| Kind | Name | Value |
| --- | --- | --- |
| Actions secret | `MACOS_CERTIFICATE_P12_BASE64` | Base64 of a password-encrypted PKCS#12 containing only the intended Developer ID certificate and its private key |
| Actions secret | `MACOS_CERTIFICATE_PASSWORD` | The PKCS#12 password |
| Actions variable | `MACOS_SIGNING_IDENTITY` | SHA-1 fingerprint shown by `security find-identity -v -p codesigning` |
| Actions variable | `MACOS_SIGNING_TEAM_ID` | `QT792GAY4C` |

Use the same certificate/password pair in both repositories. Keep private material out of Git, artifacts, logs and command-line arguments when uploading secrets; pass secret values to `gh secret set` on standard input. Remove local transfer files after verifying both repositories have the secrets. Rotation must update both repositories together and preserve the expected team and app identifiers.

`scripts/ci-signing.py` imports the identity into a randomly named temporary keychain and grants the runner's signing tool access. It validates the configured fingerprint, removes the encrypted import file, and exports only the identity fingerprint and temporary keychain path to subsequent steps. The bundle script signs with that specific keychain. Verification rejects ad-hoc signatures, wrong teams, wrong bundle IDs and hash-based designated requirements. An `always()` cleanup step restores the original search list and deletes the temporary keychain on success or failure.

Only trusted pushes to `main` and tag release jobs load signing secrets. Pull requests build with ad-hoc signing and receive no signing secrets. A missing or invalid certificate fails trusted builds/releases; it never silently falls back to ad-hoc signing. CuteAC uses this helper from its pinned Home checkout, so update both `macos.yml` and `release.yml` pins when upgrading HomeDeviceKit or this helper.

Local builds can set `CODE_SIGN_IDENTITY='Developer ID Application: Your Name (TEAMID)'`; `CODE_SIGN_KEYCHAIN` optionally limits the identity search. With no identity specified, local builds remain ad-hoc signed. To validate a bundle:

```sh
MACOS_SIGNING_TEAM_ID=QT792GAY4C python3 apps/macos/scripts/ci-signing.py verify /path/to/YunHome.app fun.yunle.home
```

See [GitHub's Apple certificate setup guide](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications) and [Apple's designated requirements documentation](https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements).
