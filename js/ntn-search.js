
function copyText(text){
navigator.clipboard.writeText(text);
alert("Copied: " + text);
}

function toggleMenu(btn){
let dropdown = btn.nextElementSibling;

document.querySelectorAll(".dropdown").forEach(d=>{
if(d!==dropdown) d.style.display="none";
});

dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
}

function searchData(){
let input = document.getElementById("searchBox").value.toLowerCase();
let rows = document.querySelectorAll("#tableBody tr");

rows.forEach(row=>{
let text = row.innerText.toLowerCase();
row.style.display = text.includes(input) ? "" : "none";
});
}
