import streamlit as st
import streamlit.components.v1 as components
from pathlib import Path
import base64

# Configure Streamlit Page
st.set_page_config(
    page_title="TIMER PRO",
    page_icon="icon.png",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Hide Streamlit default headers and paddings
st.markdown("""
<style>
    header { visibility: hidden !important; height: 0% !important; }
    footer { visibility: hidden !important; height: 0% !important; }
    #MainMenu { visibility: hidden !important; }
    .stAppDeployButton { display: none !important; }
    .block-container {
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
    }
    iframe {
        width: 100vw !important;
        height: 100vh !important;
        border: none !important;
        display: block;
    }
</style>
""", unsafe_allow_html=True)

# Load assets
current_dir = Path(__file__).parent
html_file = current_dir / "index.html"
css_file = current_dir / "style.css"
app_js = current_dir / "app.js"
audio_js = current_dir / "audio.js"
confetti_js = current_dir / "confetti.js"
icon_file = current_dir / "icon.png"

# Convert icon to base64
with open(icon_file, "rb") as img_f:
    icon_b64 = base64.b64encode(img_f.read()).decode("utf-8")
icon_data_url = f"data:image/png;base64,{icon_b64}"

with open(html_file, "r", encoding="utf-8") as f:
    content = f.read()

with open(css_file, "r", encoding="utf-8") as f:
    css_content = f.read()

with open(audio_js, "r", encoding="utf-8") as f:
    audio_content = f.read()

with open(confetti_js, "r", encoding="utf-8") as f:
    confetti_content = f.read()

with open(app_js, "r", encoding="utf-8") as f:
    app_content = f.read()

# Inline assets for seamless self-contained Streamlit Cloud execution
content = content.replace('href="icon.png"', f'href="{icon_data_url}"')
content = content.replace('src="icon.png"', f'src="{icon_data_url}"')
content = content.replace('<link rel="stylesheet" href="style.css">', f'<style>{css_content}</style>')
content = content.replace('<script src="audio.js"></script>', f'<script>{audio_content}</script>')
content = content.replace('<script src="confetti.js"></script>', f'<script>{confetti_content}</script>')
content = content.replace('<script src="app.js"></script>', f'<script>{app_content}</script>')

# Render interactive component
components.html(content, height=920, scrolling=True)
