//Global Variables

let API_URL = "https://dont-look-down-api.onrender.com" // backend URL

let target_text = ""              // the full text the user needs to type (grows via append_text)
let timer_started = false         // tracks whether the timer has started
let seconds = 0                   // counts up each second during the test
let user_selected_time = 30       // how long the test runs (default 30s)
let correct_char = 0              // number of correctly typed characters
let wpm = 0                       // calculated words per minute
let high_score = 0                // best WPM across all attempts this session
let username = ""                 // player name set by the user
let selected_category = "movies"  // which text category to fetch from ("movies" or "words")
let is_appending = false          // prevents append_text from firing multiple times at once


// DOM elements
let input_box = document.getElementById("user-text")
let username_input = document.getElementById("username")
let confirm_btn = document.getElementById("confirm-username")
let sample_text_element = document.getElementById("sample-text")


// LOAD TEXT
// Clears the page and builds spans for a brand new practice text.
// Called on page load, category change, and restart.
function load_text(sample_text) {
    target_text = sample_text
    sample_text_element.innerHTML = "" // clear any old spans first
    let temp_text = sample_text.split("")

    for (let i = 0; i < temp_text.length; i++) {
        let span = document.createElement("span")
        span.id = "char-" + i
        span.textContent = temp_text[i]
        sample_text_element.appendChild(span)
    }
}


// ============================================================
// APPEND TEXT
// Adds more spans onto the END of the existing text instead of
// replacing it. Used when the user is close to finishing so the
// test never "runs out" of text during longer timers.
// ============================================================
function append_text(new_text) {
    let start_index = sample_text_element.children.length // where to continue numbering ids from
    target_text += new_text
    let temp_text = new_text.split("")

    for (let i = 0; i < temp_text.length; i++) {
        let span = document.createElement("span")
        span.id = "char-" + (start_index + i)
        span.textContent = temp_text[i]
        sample_text_element.appendChild(span)
    }

    is_appending = false // unlock so future appends can happen again
}


// ============================================================
// RESTART
// Resets all game state back to defaults without reloading the page.
// Username and high score are NOT reset.
// ============================================================
function restart() {
    seconds = 0
    timer_started = false
    correct_char = 0
    wpm = 0
    is_appending = false

    document.getElementById("timer-display").textContent = "0"
    input_box.value = ""
    input_box.disabled = false

    fetch(`${API_URL}/get-text?category=${selected_category}`)
        .then(function(response) { return response.json() })
        .then(function(data) {
            load_text(data.text)
        })
}

document.getElementById("restart-btn").addEventListener("click", restart)


// ============================================================
// USERNAME CONFIRM
// Grabs the username, updates the high score display, then hides
// the input and button so it's out of the way.
// ============================================================
confirm_btn.addEventListener("click", function() {
    username = username_input.value
    document.getElementById("high-score-display").textContent = username + "'s Highest Score: 0"

    username_input.style.display = "none"
    confirm_btn.style.display = "none"
})


// ============================================================
// MAIN INPUT LISTENER
// Fires every time the user types in the input box.
// ============================================================
input_box.addEventListener("input", function(e) {
    let user_input = input_box.value

    // ---- Start the timer on the first keypress ----
    if (timer_started == false) {
        timer_started = true
        let timer = setInterval(function() {
            seconds++
            document.getElementById("timer-display").textContent = seconds

            // ---- Stop the timer and calculate WPM when time is up ----
            if (seconds == user_selected_time) {
                clearInterval(timer)
                input_box.disabled = true

                wpm = (correct_char / 5) * (60 / seconds)
                document.getElementById("timer-display").textContent = Math.round(wpm) + " wpm"

                // ---- Update high score if this attempt is better ----
                if (wpm > high_score) {
                    high_score = wpm
                    document.getElementById("high-score-display").textContent = username + "'s Highest Score: " + Math.round(high_score) + " wpm"
                }
            }
        }, 1000)
    }

    // ---- Fetch more text if the user is close to running out ----
    if (target_text.length - user_input.length < 50 && is_appending == false) {
        is_appending = true // lock so this doesn't fire again until the fetch finishes
        fetch(`${API_URL}/get-text?category=${selected_category}`)
            .then(function(response) { return response.json() })
            .then(function(data) {
                append_text(data.text)
            })
    }

    // ---- Reset all letters back to default color/no underline ----
    for (let i = 0; i < target_text.length; i++) {
        let temp_char = document.getElementById("char-" + i)
        temp_char.style.color = "#8ba8b8"
        temp_char.style.textDecoration = "none"
    }

    // ---- Color typed characters green/red based on correctness ----
    correct_char = 0
    for (let i = 0; i < user_input.length; i++) {
        let temp_char = document.getElementById("char-" + i)
        if (user_input[i] == target_text[i]) {
            correct_char++
            temp_char.style.color = "green"
        } else {
            temp_char.style.color = "red"
        }
    }

    // ---- Underline the current character ----
    let current_char = document.getElementById("char-" + user_input.length)
    if (current_char) {
        current_char.style.textDecoration = "underline"
    }
})


// ============================================================
// CATEGORY BUTTONS (movies / words)
// ============================================================
document.querySelectorAll(".category-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
        selected_category = btn.dataset.category
        fetch(`${API_URL}/get-text?category=${selected_category}`)
            .then(function(response) { return response.json() })
            .then(function(data) {
                load_text(data.text)
            })
    })
})


// ============================================================
// TIME BUTTONS (30 / 60 / 120 / 180)
// ============================================================
document.querySelectorAll(".time-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
        user_selected_time = parseInt(btn.dataset.time)
    })
})


// ============================================================
// INITIAL LOAD
// Fetch and load the first practice text when the page opens.
// ============================================================
fetch(`${API_URL}/get-text?category=${selected_category}`)
    .then(function(response) { return response.json() })
    .then(function(data) {
        load_text(data.text)
    })