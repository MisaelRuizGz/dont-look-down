//Global Variables

let dev = "misael"

let API_URL = "https://dont-look-down-api.onrender.com" 

let target_text = ""              
let timer_started = false         
let seconds = 0                   
let user_selected_time = 30       
let correct_char = 0              
let wpm = 0                       
let high_score = 0                
let username = ""                 
let selected_category = "movies"  
let is_appending = false    
     


// DOM elements
let input_box = document.getElementById("user-text")
let username_input = document.getElementById("username")
let confirm_btn = document.getElementById("confirm-username")
let sample_text_element = document.getElementById("sample-text")


// load text
// Called on page load, category change, and restart.
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

// append makes sure the text never runs out for users

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


// reset, puts the game state back to defaults without reloading the page.
// Username and high score are NOT reset.
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


// username 
// Grabs the username, updates the high score display then text area disappears
confirm_btn.addEventListener("click", function() {
    username = username_input.value
    document.getElementById("high-score-display").textContent = username + "'s Highest Score: 0"

    username_input.style.display = "none"
    confirm_btn.style.display = "none"
})


// main input listener, if user types in the text box this catches it
input_box.addEventListener("input", function(e) {
    let user_input = input_box.value

    // timer start on keypress
    if (timer_started == false) {
        timer_started = true
        let timer = setInterval(function() {
            seconds++
            document.getElementById("timer-display").textContent = seconds

            // timer stops and calculates wpm 
            if (seconds == user_selected_time) {
                clearInterval(timer)
                input_box.disabled = true

                wpm = (correct_char / 5) * (60 / seconds)
                document.getElementById("timer-display").textContent = Math.round(wpm) + " wpm"

                if (wpm > high_score) {
                    high_score = wpm
                    document.getElementById("high-score-display").textContent = username + "'s Highest Score: " + Math.round(high_score) + " wpm"
                }
            }
        }, 1000)
    }


    if (target_text.length - user_input.length < 50 && is_appending == false) {
        is_appending = true 
        fetch(`${API_URL}/get-text?category=${selected_category}`)
            .then(function(response) { return response.json() })
            .then(function(data) {
                append_text(data.text)
            })
    }

    // reset all letters back to default color
    for (let i = 0; i < target_text.length; i++) {
        let temp_char = document.getElementById("char-" + i)
        temp_char.style.color = "#8ba8b8"
        temp_char.style.textDecoration = "none"
    }

    // color typed characters green/red 
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

    // underline the current character 
    let current_char = document.getElementById("char-" + user_input.length)
    if (current_char) {
        current_char.style.textDecoration = "underline"
    }
})



// category buttons 
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


// time buttons
document.querySelectorAll(".time-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
        user_selected_time = parseInt(btn.dataset.time)
    })
})



// initial load, fetch and load the first practice text when the page opens.
fetch(`${API_URL}/get-text?category=${selected_category}`)
    .then(function(response) { return response.json() })
    .then(function(data) {
        load_text(data.text)
    })