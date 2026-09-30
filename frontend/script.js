let API_URL = "https://dont-look-down-api.onrender.com"

const RENDER_BATCH = 60

let words = []
let word_index = 0
let word_states = []          // per-word {typed, correct}, once committed
let render_window_start = 0
let is_appending = false

let timer = null
let timer_started = false
let seconds = 0
let user_selected_time = 30
let correct_chars = 0
let wpm = 0

let high_score = 0
let username = "Guest"
let selected_category = "movies"
let auth_token = localStorage.getItem("auth_token") || null

let input_box = document.getElementById("user-text")
let sample_text_element = document.getElementById("sample-text")
let words_container = document.getElementById("words-container")
let caret_el = document.getElementById("caret")
let type_area_el = document.getElementById("type-area")


// modal
function show_modal() { document.getElementById("auth-modal").style.display = "flex" }
function hide_modal() { document.getElementById("auth-modal").style.display = "none" }
function show_choice() {
    document.getElementById("modal-choice").style.display = "block"
    document.getElementById("modal-login").style.display = "none"
    document.getElementById("modal-signup").style.display = "none"
}

document.getElementById("close-modal-btn").addEventListener("click", hide_modal)
document.getElementById("auth-modal").addEventListener("click", function(e) {
    if (e.target.id === "auth-modal") hide_modal()
})

document.getElementById("show-login-btn").addEventListener("click", function() {
    document.getElementById("modal-choice").style.display = "none"
    document.getElementById("modal-login").style.display = "block"
})
document.getElementById("show-signup-btn").addEventListener("click", function() {
    document.getElementById("modal-choice").style.display = "none"
    document.getElementById("modal-signup").style.display = "block"
})
document.getElementById("back-from-login").addEventListener("click", show_choice)
document.getElementById("back-from-signup").addEventListener("click", show_choice)
document.getElementById("guest-btn").addEventListener("click", hide_modal)

document.getElementById("account-btn").addEventListener("click", function() {
    if (auth_token) {
        if (confirm("Log out of " + username + "?")) logout()
    } else {
        show_choice()
        show_modal()
    }
})

function update_account_button() {
    document.getElementById("account-btn").textContent = auth_token ? username : "Account"
}

function logout() {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_username")
    auth_token = null
    username = "Guest"
    high_score = 0
    update_account_button()
    update_score_display()
    render_history()
}

// login
document.getElementById("login-submit-btn").addEventListener("click", function() {
    let login_username = document.getElementById("login-username").value
    let login_password = document.getElementById("login-password").value
    let error_el = document.getElementById("login-error")

    if (!login_username || !login_password) {
        error_el.textContent = "Fill in both fields"
        return
    }

    let form_data = new URLSearchParams()
    form_data.append("username", login_username)
    form_data.append("password", login_password)

    fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form_data
    })
    .then(function(response) { return response.json() })
    .then(function(data) {
        if (data.access_token) {
            auth_token = data.access_token
            localStorage.setItem("auth_token", auth_token)
            localStorage.setItem("auth_username", login_username)
            username = login_username
            update_account_button()
            hide_modal()
            load_saved_score()
            load_history()
        } else {
            error_el.textContent = typeof data.detail === "string" ? data.detail : "Login failed"
        }
    })
})

// signup
document.getElementById("signup-submit-btn").addEventListener("click", function() {
    let signup_username = document.getElementById("signup-username").value
    let signup_password = document.getElementById("signup-password").value
    let error_el = document.getElementById("signup-error")

    if (!signup_username || !signup_password) {
        error_el.textContent = "Fill in both fields"
        return
    }

    fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: signup_username, password: signup_password })
    })
    .then(function(response) { return response.json() })
    .then(function(data) {
        if (data.message === "Account created successfully") {
            let form_data = new URLSearchParams()
            form_data.append("username", signup_username)
            form_data.append("password", signup_password)

            fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: form_data
            })
            .then(function(r) { return r.json() })
            .then(function(login_data) {
                auth_token = login_data.access_token
                localStorage.setItem("auth_token", auth_token)
                localStorage.setItem("auth_username", signup_username)
                username = signup_username
                update_account_button()
                hide_modal()
                load_saved_score()
                load_history()
            })
        } else {
            error_el.textContent = typeof data.detail === "string" ? data.detail : "Signup failed"
        }
    })
})


// score
function update_score_display() {
    document.getElementById("high-score-display").textContent =
        username + "'s Highest Score: " + Math.round(high_score) + " wpm"
}

function load_saved_score() {
    if (!auth_token) return
    fetch(`${API_URL}/get-score`, { headers: { "Authorization": "Bearer " + auth_token } })
    .then(function(r) {
        if (r.status === 401) { logout(); return null }
        return r.json()
    })
    .then(function(data) {
        if (!data) return
        high_score = data.high_score || 0
        update_score_display()
    })
}

function save_score_to_db(score) {
    if (!auth_token) return
    fetch(`${API_URL}/save-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + auth_token },
        body: JSON.stringify({ high_score: score })
    })
}


// history
function record_attempt(attempt) {
    if (auth_token) {
        fetch(`${API_URL}/save-attempt`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + auth_token },
            body: JSON.stringify(attempt)
        }).then(function() { load_history() })
    } else {
        let history = JSON.parse(localStorage.getItem("guest_history") || "[]")
        history.unshift({
            category: attempt.category,
            duration: attempt.duration,
            wpm: attempt.wpm,
            created_at: new Date().toISOString()
        })
        history = history.slice(0, 20)
        localStorage.setItem("guest_history", JSON.stringify(history))
        render_history()
    }
}

function load_history() {
    if (!auth_token) { render_history(); return }
    fetch(`${API_URL}/get-history`, { headers: { "Authorization": "Bearer " + auth_token } })
    .then(function(r) {
        if (r.status === 401) { logout(); return null }
        return r.json()
    })
    .then(function(data) {
        if (!data) return
        render_history(data.history)
    })
}

function render_history(list) {
    let container = document.getElementById("history-list")
    let attempts = list || JSON.parse(localStorage.getItem("guest_history") || "[]")

    container.innerHTML = ""
    if (attempts.length === 0) {
        container.innerHTML = "<p class='history-empty'>No attempts yet — finish a run to see it here</p>"
        return
    }

    attempts.forEach(function(a) {
        let row = document.createElement("p")
        row.className = "history-row"
        let date_str = new Date(a.created_at).toLocaleString()
        row.textContent = date_str + " — " + a.category + ", " + a.duration + "s — " + a.wpm + " wpm"
        container.appendChild(row)
    })
}


// ---- word-based typing engine ----

function build_word_element(word, index) {
    let word_div = document.createElement("div")
    word_div.className = "word"
    word_div.id = "word-" + index
    for (let i = 0; i < word.length; i++) {
        let letter_span = document.createElement("span")
        letter_span.className = "letter"
        letter_span.textContent = word[i]
        word_div.appendChild(letter_span)
    }
    return word_div
}

function render_window(start_index) {
    render_window_start = start_index
    words_container.innerHTML = ""
    let end_index = Math.min(words.length, start_index + RENDER_BATCH)
    for (let i = start_index; i < end_index; i++) {
        words_container.appendChild(build_word_element(words[i], i))
    }
    mark_active_word()
    update_caret()
}

function mark_active_word() {
    let prev = document.querySelector(".word.current")
    if (prev) prev.classList.remove("current")
    let el = document.getElementById("word-" + word_index)
    if (el) el.classList.add("current")
}

// restyle only the current word — this is what keeps typing smooth on long text
function render_current_word_state() {
    let word_el = document.getElementById("word-" + word_index)
    if (!word_el) return
    let target_word = words[word_index] || ""
    let typed = input_box.value

    word_el.querySelectorAll(".extra").forEach(function(el) { el.remove() })

    let letter_spans = word_el.querySelectorAll(".letter")
    for (let i = 0; i < letter_spans.length; i++) {
        letter_spans[i].className = "letter"
        if (i < typed.length) {
            letter_spans[i].classList.add(typed[i] === target_word[i] ? "correct" : "incorrect")
        }
    }

    if (typed.length > target_word.length) {
        for (let i = target_word.length; i < typed.length; i++) {
            let extra_span = document.createElement("span")
            extra_span.className = "letter extra incorrect"
            extra_span.textContent = typed[i]
            word_el.appendChild(extra_span)
        }
    }

    update_caret()
}

function update_caret() {
    let word_el = document.getElementById("word-" + word_index)
    if (!word_el) return

    let typed_len = input_box.value.length
    let all_letters = word_el.querySelectorAll(".letter")
    let target_el = all_letters[typed_len]
    let place_before = true

    if (!target_el) {
        target_el = all_letters[all_letters.length - 1]
        place_before = false
    }
    if (!target_el) return

    let rect = target_el.getBoundingClientRect()
    let container_rect = sample_text_element.getBoundingClientRect()

    caret_el.style.top = (rect.top - container_rect.top) + "px"
    caret_el.style.left = ((place_before ? rect.left : rect.right) - container_rect.left) + "px"
    caret_el.style.height = rect.height + "px"
}

function maybe_extend_render_window() {
    if (words.length - word_index < 20 && is_appending == false) {
        is_appending = true
        fetch(`${API_URL}/get-text?category=${selected_category}`)
            .then(function(response) { return response.json() })
            .then(function(data) {
                let new_words = data.text.split(/\s+/).filter(Boolean)
                words = words.concat(new_words)
                is_appending = false
            })
    }

    // slide the render window forward, keeping the previous word so a correction is still possible
    if (word_index - render_window_start >= RENDER_BATCH - 10) {
        render_window(Math.max(0, word_index - 1))
    }
}

function commit_word() {
    let typed = input_box.value
    let target_word = words[word_index] || ""
    let word_el = document.getElementById("word-" + word_index)
    let is_correct = typed === target_word

    word_states[word_index] = { typed: typed, correct: is_correct }

    if (word_el) {
        word_el.classList.remove("current")
        word_el.classList.add(is_correct ? "word-correct" : "word-incorrect")
    }

    if (is_correct) {
        correct_chars += target_word.length + 1 // +1 for the space
    }

    word_index++
    input_box.value = ""
    maybe_extend_render_window()
    mark_active_word()
    update_caret()
}

function start_timer() {
    timer_started = true
    timer = setInterval(function() {
        seconds++
        document.getElementById("timer-display").textContent = seconds

        if (seconds == user_selected_time) {
            clearInterval(timer)
            input_box.disabled = true

            wpm = (correct_chars / 5) * (60 / seconds)
            let rounded_wpm = Math.round(wpm)
            document.getElementById("timer-display").textContent = rounded_wpm + " wpm"

            record_attempt({ category: selected_category, duration: user_selected_time, wpm: rounded_wpm })

            if (wpm > high_score) {
                high_score = wpm
                update_score_display()
                save_score_to_db(rounded_wpm)
            }
        }
    }, 1000)
}

function restart() {
    if (timer) clearInterval(timer)
    seconds = 0
    timer_started = false
    wpm = 0
    correct_chars = 0
    is_appending = false
    word_index = 0
    word_states = []
    words = []

    document.getElementById("timer-display").textContent = "0"
    input_box.value = ""
    input_box.disabled = false
    input_box.focus()

    fetch(`${API_URL}/get-text?category=${selected_category}`)
        .then(function(response) { return response.json() })
        .then(function(data) {
            words = data.text.split(/\s+/).filter(Boolean)
            render_window(0)
        })
}
document.getElementById("restart-btn").addEventListener("click", restart)


// keydown: space commits the word, backspace-on-empty can undo the previous wrong word
input_box.addEventListener("keydown", function(e) {
    if (e.key === " ") {
        e.preventDefault()
        if (input_box.value.length > 0) commit_word()
        return
    }

    if (e.key === "Backspace" && input_box.value.length === 0 && word_index > 0) {
        let prev_state = word_states[word_index - 1]
        if (prev_state && !prev_state.correct) {
            e.preventDefault()
            word_index--
            let prev_el = document.getElementById("word-" + word_index)
            if (prev_el) prev_el.classList.remove("word-incorrect")
            input_box.value = prev_state.typed
            word_states[word_index] = undefined
            mark_active_word()
            render_current_word_state()
        }
    }
})

// input: normal typing and backspace-within-word — only restyles the current word
input_box.addEventListener("input", function() {
    if (timer_started == false) start_timer()
    render_current_word_state()
})

// click anywhere in the typing area to focus; show a hint when not focused
input_box.addEventListener("focus", function() { type_area_el.classList.remove("blurred") })
input_box.addEventListener("blur", function() { type_area_el.classList.add("blurred") })
type_area_el.addEventListener("click", function() { input_box.focus() })


// category / time buttons
document.querySelectorAll(".category-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
        document.querySelectorAll(".category-btn").forEach(function(b) { b.classList.remove("active") })
        btn.classList.add("active")
        selected_category = btn.dataset.category
        restart()
    })
})

document.querySelectorAll(".time-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
        document.querySelectorAll(".time-btn").forEach(function(b) { b.classList.remove("active") })
        btn.classList.add("active")
        user_selected_time = parseInt(btn.dataset.time)
    })
})


// initial load — no forced modal, guest can type immediately
if (auth_token) {
    username = localStorage.getItem("auth_username") || "User"
    load_saved_score()
    load_history()
}
update_account_button()
render_history()

fetch(`${API_URL}/get-text?category=${selected_category}`)
    .then(function(response) { return response.json() })
    .then(function(data) {
        words = data.text.split(/\s+/).filter(Boolean)
        render_window(0)
        input_box.focus()
    })