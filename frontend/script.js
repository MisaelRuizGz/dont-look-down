let API_URL = "https://dont-look-down-api.onrender.com"

let target_text = ""
let timer = null
let timer_started = false
let seconds = 0
let user_selected_time = 30
let correct_char = 0
let wpm = 0
let high_score = 0
let username = "Guest"
let selected_category = "movies"
let is_appending = false
let prev_length = 0
let auth_token = localStorage.getItem("auth_token") || null

let input_box = document.getElementById("user-text")
let sample_text_element = document.getElementById("sample-text")


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


// text loading
function load_text(sample_text) {
    target_text = sample_text
    prev_length = 0
    sample_text_element.innerHTML = ""
    let temp_text = sample_text.split("")
    for (let i = 0; i < temp_text.length; i++) {
        let span = document.createElement("span")
        span.id = "char-" + i
        span.textContent = temp_text[i]
        sample_text_element.appendChild(span)
    }
}

function append_text(new_text) {
    let start_index = sample_text_element.children.length
    target_text += new_text
    let temp_text = new_text.split("")
    for (let i = 0; i < temp_text.length; i++) {
        let span = document.createElement("span")
        span.id = "char-" + (start_index + i)
        span.textContent = temp_text[i]
        sample_text_element.appendChild(span)
    }
    is_appending = false
}


// restart
function restart() {
    if (timer) clearInterval(timer)
    seconds = 0
    timer_started = false
    correct_char = 0
    wpm = 0
    is_appending = false
    prev_length = 0

    document.getElementById("timer-display").textContent = "0"
    input_box.value = ""
    input_box.disabled = false
    input_box.focus()

    fetch(`${API_URL}/get-text?category=${selected_category}`)
        .then(function(response) { return response.json() })
        .then(function(data) { load_text(data.text) })
}
document.getElementById("restart-btn").addEventListener("click", restart)


// main typing listener
input_box.addEventListener("input", function(e) {
    let user_input = input_box.value

    if (timer_started == false) {
        timer_started = true
        timer = setInterval(function() {
            seconds++
            document.getElementById("timer-display").textContent = seconds

            if (seconds == user_selected_time) {
                clearInterval(timer)
                input_box.disabled = true

                wpm = (correct_char / 5) * (60 / seconds)
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

    if (target_text.length - user_input.length < 50 && is_appending == false) {
        is_appending = true
        fetch(`${API_URL}/get-text?category=${selected_category}`)
            .then(function(response) { return response.json() })
            .then(function(data) { append_text(data.text) })
    }

    let limit = Math.min(target_text.length, Math.max(user_input.length, prev_length) + 1)
    for (let i = 0; i < limit; i++) {
        let temp_char = document.getElementById("char-" + i)
        temp_char.style.color = "#8ba8b8"
        temp_char.style.textDecoration = "none"
    }
    prev_length = user_input.length

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

    let current_char = document.getElementById("char-" + user_input.length)
    if (current_char) current_char.style.textDecoration = "underline"
})


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
    .then(function(data) { load_text(data.text) })