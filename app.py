from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import random

app = FastAPI()

# Allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Remember last movie file
last_chosen_movie = None

# WORD GENERATOR, Picks random words from a txt file
def get_random_words(filename, amount=100):
    with open(filename, "r", encoding="utf-8") as file:
        words = file.read().split()

    random.shuffle(words)

    return " ".join(words[:amount])



# Text api
@app.get("/get-text")
def get_text(category: str = "movies"):

    global last_chosen_movie

    print("CATEGORY RECEIVED:", category)


    
    # checks if user selects words or movies

    # words mod
    if category == "words":

        words_folder = "data/words"

        print("Looking in:", words_folder)

        files = [
            f for f in os.listdir(words_folder)
            if f.endswith(".txt")
        ]

        print("Word files found:", files)


        if len(files) == 0:
            return {
                "text": "No word files found"
            }


        chosen = random.choice(files)

        print("Chosen word file:", chosen)


        text = get_random_words(
            os.path.join(words_folder, chosen),
            100
        )


        return {
            "text": text
        }



    
    # movie mode
    if category == "movies":

        movies_folder = "data/movies"

        print("Looking in:", movies_folder)

        files = [
            f for f in os.listdir(movies_folder)
            if f.endswith(".txt")
        ]


        print("Movie files found:", files)


        if len(files) == 0:
            return {
                "text": "No movie files found"
            }


        available = [
            f for f in files
            if f != last_chosen_movie
        ]


        if len(available) == 0:
            available = files


        chosen = random.choice(available)

        last_chosen_movie = chosen


        print("Chosen movie file:", chosen)


        with open(
            os.path.join(movies_folder, chosen),
            "r",
            encoding="utf-8"
        ) as file:
            text = file.read()


        return {
            "text": text
        }

    # UNKNOWN CATEGORY
    return {
        "text": "Invalid category"
    }