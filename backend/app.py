from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg2
import os
import random

load_dotenv()


# CONFIG
DATABASE_URL = os.getenv("DATABASE_URL")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# app start up 
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# connect to database
def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        conn.close()


# PYDANTIC MODELS
class UserCreate(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ScoreUpdate(BaseModel):
    high_score: int

# JWT helpers
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), conn = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    cur = conn.cursor()
    cur.execute("SELECT id, username FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return {"id": user[0], "username": user[1]}

# auth end points
@app.post("/signup")
def signup(user: UserCreate, conn = Depends(get_db)):
    cur = conn.cursor()

    # Check if username already exists
    cur.execute("SELECT id FROM users WHERE username = %s", (user.username,))
    if cur.fetchone():
        raise HTTPException(status_code=400, detail="Username already taken")

    # Hash the password and insert user
    hashed_password = pwd_context.hash(user.password)
    cur.execute(
        "INSERT INTO users (username, password) VALUES (%s, %s) RETURNING id",
        (user.username, hashed_password)
    )
    user_id = cur.fetchone()[0]

    # Create a scores row for this user
    cur.execute("INSERT INTO scores (user_id, high_score) VALUES (%s, %s)", (user_id, 0))
    conn.commit()

    return {"message": "Account created successfully"}

@app.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), conn = Depends(get_db)):
    cur = conn.cursor()

    # Look up the user
    cur.execute("SELECT id, username, password FROM users WHERE username = %s", (form_data.username,))
    user = cur.fetchone()

    # Verify password
    if not user or not pwd_context.verify(form_data.password, user[2]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    # Generate and return token
    token = create_access_token({"sub": user[1]})
    return {"access_token": token, "token_type": "bearer"}

# score end points
@app.get("/get-score")
def get_score(current_user = Depends(get_current_user), conn = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT high_score FROM scores WHERE user_id = %s", (current_user["id"],))
    result = cur.fetchone()
    return {"high_score": result[0] if result else 0}

@app.post("/save-score")
def save_score(score: ScoreUpdate, current_user = Depends(get_current_user), conn = Depends(get_db)):
    cur = conn.cursor()
    cur.execute(
        "UPDATE scores SET high_score = %s, updated_at = NOW() WHERE user_id = %s AND %s > high_score",
        (score.high_score, current_user["id"], score.high_score)
    )
    conn.commit()
    return {"message": "Score saved"}


# HEALTH CHECK
# Keeps Supabase active via cron ping
@app.get("/health")
def health(conn = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT 1")
    return {"status": "ok"}

# text endpoints
last_chosen_movie = None

def get_random_words(filename, amount=100):
    with open(filename, "r", encoding="utf-8") as file:
        words = file.read().split()
    random.shuffle(words)
    return " ".join(words[:amount])

@app.get("/get-text")
def get_text(category: str = "movies"):
    global last_chosen_movie

    if category == "words":
        words_folder = "data/words"
        files = [f for f in os.listdir(words_folder) if f.endswith(".txt")]
        if len(files) == 0:
            return {"text": "No word files found"}
        chosen = random.choice(files)
        text = get_random_words(os.path.join(words_folder, chosen), 100)
        return {"text": text}

    if category == "movies":
        movies_folder = "data/movies"
        files = [f for f in os.listdir(movies_folder) if f.endswith(".txt")]
        if len(files) == 0:
            return {"text": "No movie files found"}
        available = [f for f in files if f != last_chosen_movie]
        if len(available) == 0:
            available = files
        chosen = random.choice(available)
        last_chosen_movie = chosen
        with open(os.path.join(movies_folder, chosen), "r", encoding="utf-8") as file:
            text = file.read()
        return {"text": text}

    return {"text": "Invalid category"}