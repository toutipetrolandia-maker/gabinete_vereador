
export const isBiometricSupported = async () => {
  if (!window.PublicKeyCredential) return false;
  
  // Check if platform authenticator is available (TouchID, FaceID, Windows Hello, etc.)
  return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
};

export const registerBiometrics = async (userId: string, email: string) => {
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userID = new TextEncoder().encode(userId);

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: "Gabinete Digital",
        id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
      },
      user: {
        id: userID,
        name: email,
        displayName: email.split('@')[0],
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "required",
      },
      timeout: 60000,
      attestation: "none",
    };

    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    }) as PulseKeyCredential;

    if (credential) {
      localStorage.setItem('biometric_registered', 'true');
      localStorage.setItem('biometric_user_id', userId);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error registering biometrics:", err);
    throw err;
  }
};

export const authenticateBiometrics = async () => {
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [],
      userVerification: "required",
      timeout: 60000,
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    });

    return !!assertion;
  } catch (err) {
    console.error("Error authenticating biometrics:", err);
    throw err;
  }
};

interface PulseKeyCredential extends Credential {
    rawId: ArrayBuffer;
    response: AuthenticatorResponse;
}
