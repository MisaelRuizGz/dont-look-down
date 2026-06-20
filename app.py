'''
app.py 

This python file should get the sample text from 
the txt file, create a version that works with the 
JS file (add "" around each letter ("a"))

Randomize which sample text gets choosen, also make
it so that the same one cant be chosen twice in a row


'''

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import random

app = FastAPI()

# Allow the frontend to talk to the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

last_chosen = None

@app.get("/get-text")
def get_text(category: str = "movies"):
    global last_chosen

    texts_folder = f"texts/{category}"
    files = [f for f in os.listdir(texts_folder) if f.endswith(".txt")]

    available = [f for f in files if f != last_chosen]

    if len(available) == 0:
        available = files

    chosen = random.choice(available)
    last_chosen = chosen

    with open(os.path.join(texts_folder, chosen), "r") as file:
        text = file.read()

    return {"text": text}