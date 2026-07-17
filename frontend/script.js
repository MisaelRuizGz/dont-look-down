
let API_URL = "https://dont-look-down-api.onrender.com"

let target_text = ""
let timer_started = false
let seconds = 0
let user_selected_time = 30
let correct_char = 0
let wpm = 0
let high_score = 0
let username = "Guest"
let selected_category = "movies"
let is_appending = false
let auth_token = localStorage.getItem("auth_token") || null

// dom elements
let input_box = document.getElementById("user-text")
let sample_text_element = document.getElementById("sample-text")


// modal stuff
function show_modal() {
    document.getElementById("auth-modal").style.display = "flex"
}

function hide_modal() {
    document.getElementById("auth-modal").style.display = "none"
}

function show_choice() {
    document.getElementById("modal-choice").style.display = "block"
    document.getElementById("modal-login").style.display = "none"
    document.getElementById("modal-signup").style.display = "none"
}

// nagivation buttons
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

// guest button
document.getElementById("guest-btn").addEventListener("click", function() {
    username = "Guest"
    hide_modal()
    update_score_display()
})

// login submit
document.getElementById("login-submit-btn").addEventListener("click", function() {
    let login_username = document.getElementById("login-username").value
    let login_password = document.getElementById("login-password").value
    let error_el = document.getElementById("login-error")

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
            hide_modal()
            load_saved_score()
        } else {
            error_el.textContent = data.detail || "Login failed"
        }
    })
})

// sign up submit
document.getElementById("signup-submit-btn").addEventListener("click", function() {
    let signup_username = document.getElementById("signup-username").value
    let signup_password = document.getElementById("signup-password").value
    let error_el = document.getElementById("signup-error")

    fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: signup_username, password: signup_password })
    })
    .then(function(response) { return response.json() })
    .then(function(data) {
        if (data.message === "Account created successfully") {
            // Auto login after signup
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
                hide_modal()
                load_saved_score()
            })
        } else {
            error_el.textContent = data.detail || "Signup failed"
        }
    })
})


// score
function update_score_display() {
    document.getElementById("high-score-display").textContent = username + "'s Highest Score: " + Math.round(high_score) + " wpm"
    if (auth_token) {
    username = localStorage.getItem("auth_username") || "User"
    load_saved_score()
    update_score_display()
    hide_modal()
} else {
    show_modal()
}
}

function load_saved_score() {
    if (!auth_token) return

    fetch(`${API_URL}/get-score`, {
        headers: { "Authorization": "Bearer " + auth_token }
    })
    .then(function(r) { return r.json() })
    .then(function(data) {
        high_score = data.high_score || 0
        update_score_display()
    })
}

function save_score_to_db(score) {
    if (!auth_token) return

    fetch(`${API_URL}/save-score`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + auth_token
        },
        body: JSON.stringify({ high_score: score })
    })
}


// LOAD TEXT
function load_text(sample_text) {
    target_text = sample_text
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



// RESTART
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
        .then(function(data) { load_text(data.text) })
}

document.getElementById("restart-btn").addEventListener("click", restart)


// main listener
input_box.addEventListener("input", function(e) {
    let user_input = input_box.value

    if (timer_started == false) {
        timer_started = true
        let timer = setInterval(function() {
            seconds++
            document.getElementById("timer-display").textContent = seconds

            if (seconds == user_selected_time) {
                clearInterval(timer)
                input_box.disabled = true

                wpm = (correct_char / 5) * (60 / seconds)
                document.getElementById("timer-display").textContent = Math.round(wpm) + " wpm"

                if (wpm > high_score) {
                    high_score = wpm
                    update_score_display()
                    save_score_to_db(Math.round(wpm))
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

    for (let i = 0; i < target_text.length; i++) {
        let temp_char = document.getElementById("char-" + i)
        temp_char.style.color = "#8ba8b8"
        temp_char.style.textDecoration = "none"
    }

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
    if (current_char) {
        current_char.style.textDecoration = "underline"
    }
})


// catagory buttons
document.querySelectorAll(".category-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
        selected_category = btn.dataset.category
        fetch(`${API_URL}/get-text?category=${selected_category}`)
            .then(function(response) { return response.json() })
            .then(function(data) { load_text(data.text) })
    })
})


// time buttons
document.querySelectorAll(".time-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
        user_selected_time = parseInt(btn.dataset.time)
    })
})


// inital load
// Check if already logged in
if (auth_token) {
    username = localStorage.getItem("auth_username") || "User"
    load_saved_score()
    hide_modal()
} else {
    show_modal()
}

// Load practice text
fetch(`${API_URL}/get-text?category=${selected_category}`)
    .then(function(response) { return response.json() })
    .then(function(data) { load_text(data.text) })