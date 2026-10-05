import re
import bcrypt

def hash_password(password: str) -> str:
    """
    Securely hashes a plaintext password using bcrypt with salt.
    """
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plaintext password against a stored bcrypt hash.
    Safe against timing attacks.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validates password complexity:
    - Minimum 8 characters
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    return True, ""
