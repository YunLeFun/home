# macOS release signing

Home 0.2.2 and CuteAC 0.4.2 use the same Developer ID Application certificate, team `QT792GAY4C`. Each app keeps its existing bundle identifier and HA Keychain service/account. The first upgrade from an ad-hoc build can still request “Always Allow”; subsequent builds retain the same designated requirement while this signing identity remains consistent. Developer ID builds are signed with the hardened runtime and a secure timestamp so Home releases can be notarized (see [Notarization](#notarization)).

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

## Notarization

`scripts/notarize.sh APP OUTPUT_ZIP` verifies the signature, submits the app with `xcrun notarytool --wait`, prints Apple's log on rejection, then staples the ticket, checks it with `spctl` and zips the stapled app. The Home release workflow runs it after the relocated-launch check, so the uploaded `YunHome-<version>.zip` opens without a Gatekeeper warning, even offline.

The workflow authenticates with an App Store Connect API key (any key with the Developer role or higher). Configure these in `YunLeFun/home`; CuteAC can reuse them when its release adopts the script:

| Kind | Name | Value |
| --- | --- | --- |
| Actions secret | `MACOS_NOTARY_KEY_P8_BASE64` | Base64 of the `AuthKey_<KEY_ID>.p8` file |
| Actions secret | `MACOS_NOTARY_KEY_ID` | The key ID |
| Actions secret | `MACOS_NOTARY_ISSUER_ID` | The App Store Connect issuer ID |

Pipe the values into `gh secret set` on standard input, for example `base64 -i AuthKey_<KEY_ID>.p8 | gh secret set MACOS_NOTARY_KEY_P8_BASE64 -R YunLeFun/home`. The script decodes the key into a private temporary directory that is removed on exit.

Locally, either store a profile once with `xcrun notarytool store-credentials` and pass `NOTARY_KEYCHAIN_PROFILE`, or point at a key file:

```sh
CODE_SIGN_IDENTITY='Developer ID Application: Lan Yang (QT792GAY4C)' bash apps/macos/scripts/bundle.sh
NOTARY_KEY_PATH=~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8 NOTARY_KEY_ID=<KEY_ID> NOTARY_ISSUER=<ISSUER_ID> \
  bash apps/macos/scripts/notarize.sh apps/macos/build/YunHome.app YunHome.zip
```
