import asyncio
import os
import sys
import socket
import glob
import threading
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Load environment variables
load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT")

# Load authorized user IDs from environment
AUTHORIZED_USERS_STR = os.getenv("AUTHORIZED_TELEGRAM_USERS", "")
AUTHORIZED_USERS = set()
if AUTHORIZED_USERS_STR:
    try:
        AUTHORIZED_USERS = {int(uid.strip()) for uid in AUTHORIZED_USERS_STR.split(",") if uid.strip()}
    except ValueError:
        print("Warning: Invalid AUTHORIZED_TELEGRAM_USERS format. Use comma-separated IDs.")

# Thread pool for running blocking operations
executor = ThreadPoolExecutor(max_workers=2)

# Track generation status
generation_status = {"running": False, "current_file": None, "progress": ""}


def is_authorized(user_id: int) -> bool:
    """Check if a user is authorized to use bot commands."""
    # If no users configured, deny all (security by default)
    if not AUTHORIZED_USERS:
        return False
    return user_id in AUTHORIZED_USERS


def get_local_ip_address():
    """Fetches the local IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except socket.error as e:
        print(f"Error getting local IP address: {e}")
        return None


def get_input_dir():
    """Get the contents/input directory path."""
    # Navigate from backend to project root, then to contents
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(backend_dir)
    return os.path.join(project_dir, "contents")


def get_available_scripts():
    """Returns list of available JSON script files."""
    input_dir = get_input_dir()
    if not os.path.exists(input_dir):
        return []
    scripts = glob.glob(os.path.join(input_dir, "*.json"))
    return [os.path.basename(s) for s in scripts]


def generate_reel_sync(filename: str, audio_mode: str = "gemini"):
    """Synchronous reel generation - runs in thread pool."""
    global generation_status
    
    try:
        # Import here to avoid circular imports and ensure proper path
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        
        from config import INPUT_DIR, OUTPUT_DIR, TEMP_DIR
        from processors.reel_generator import ReelGenerator
        
        input_path = os.path.join(INPUT_DIR, filename)
        
        if not os.path.exists(input_path):
            return False, f"File not found: {filename}"
        
        os.makedirs(TEMP_DIR, exist_ok=True)
        
        generation_status["current_file"] = filename
        generation_status["progress"] = "Starting generation..."
        
        generator = ReelGenerator(input_path)
        generator.create_reel(audio_mode)
        
        generation_status["progress"] = "Completed!"
        return True, f"Successfully generated reel for {filename}"
        
    except Exception as e:
        return False, f"Error generating reel: {str(e)}"


def generate_script_sync(topic: str, filename: str, prompt_name: str = "blinked_thrice.txt", char_a: str = "Aman", char_b: str = "Isha"):
    """Synchronous script generation - runs in thread pool."""
    global generation_status
    
    try:
        # Import here to avoid circular imports
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        
        from config import PROMPTS_DIR
        from services.content_writer import generate_content
        
        # Build prompt path
        prompt_path = os.path.join(PROMPTS_DIR, prompt_name)
        if not os.path.exists(prompt_path):
            return False, f"Prompt not found: {prompt_name}"
        
        # Ensure filename has .json extension
        if not filename.endswith(".json"):
            filename += ".json"
        
        generation_status["current_file"] = filename
        generation_status["progress"] = "Generating script..."
        
        success = generate_content(topic, filename, prompt_path, char_a, char_b)
        
        if success:
            generation_status["progress"] = "Script completed!"
            return True, f"Successfully generated script: {filename}"
        else:
            return False, "Script generation failed"
        
    except Exception as e:
        return False, f"Error generating script: {str(e)}"


    except Exception as e:
        return False, f"Error generating script: {str(e)}"


def generate_caption_sync(filename: str) -> str:
    """Synchronous caption generation."""
    try:
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        
        from config import INPUT_DIR
        from services.caption_generator import generate_caption
        
        if not filename.endswith(".json"):
            filename += ".json"
            
        script_path = os.path.join(INPUT_DIR, filename)
        if not os.path.exists(script_path):
            return None
            
        return generate_caption(script_path)
    except Exception as e:
        print(f"Caption generation error: {e}")
        return None


    """Returns list of available prompt files."""
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    
    try:
        from config import PROMPTS_DIR
        prompts = glob.glob(os.path.join(PROMPTS_DIR, "*.txt"))
        return [os.path.basename(p) for p in prompts]
    except:
        return []


def get_available_characters():
    """Returns list of available characters."""
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    
    try:
        from config import CHARACTER_MAP
        return list(CHARACTER_MAP.keys())
    except:
        return ["Aman", "Isha"]


async def unauthorized_response(update: Update) -> None:
    """Send unauthorized message."""
    user_id = update.effective_user.id
    await update.message.reply_text(
        f"⛔ Unauthorized access.\n"
        f"Your user ID: `{user_id}`\n\n"
        f"Contact the bot owner to get access.",
        parse_mode="Markdown"
    )


async def help_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show available commands."""
    if not is_authorized(update.effective_user.id):
        await unauthorized_response(update)
        return
    
    help_text = """🎬 Faceless Reel Generator Bot

📝 Script Commands:
• /script topic filename - Generate new script
• /prompts - List available prompts  
• /characters - List available characters

🎥 Reel Commands:
• /reel topic - Full Auto: Script -> Reel -> Caption
• /list - List available content scripts
• /generate filename - Generate reel & send video
• /generate_all - Generate all reels
• /status - Check current generation status

🔧 Utility:
• /help - Show this help message
• /ip - Get local server address

📖 Examples:
/reel benefits of meditation
/script benefits of yoga yoga_benefits
/generate yoga_benefits

🔊 Audio: gemini, elevenlabs, mac_say
"""
    await update.message.reply_text(help_text)


async def ip_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Responds with the local IP address."""
    if not is_authorized(update.effective_user.id):
        await unauthorized_response(update)
        return
    
    local_ip = get_local_ip_address()
    if local_ip:
        message = f"🌐 Dashboard: http://{local_ip}:3031"
    else:
        message = "Could not determine the local IP address."
    
    await update.message.reply_text(message)


async def list_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """List available content scripts."""
    if not is_authorized(update.effective_user.id):
        await unauthorized_response(update)
        return
    
    scripts = get_available_scripts()
    
    if not scripts:
        await update.message.reply_text("📁 No content scripts found.")
        return
    
    scripts_list = "\n".join([f"• `{s}`" for s in sorted(scripts)])
    await update.message.reply_text(
        f"📁 *Available Scripts ({len(scripts)}):*\n\n{scripts_list}",
        parse_mode="Markdown"
    )


async def generate_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Generate reel for a specific script."""
    global generation_status
    
    if not is_authorized(update.effective_user.id):
        await unauthorized_response(update)
        return
    
    if generation_status["running"]:
        await update.message.reply_text(
            f"⏳ Generation already in progress for: `{generation_status['current_file']}`",
            parse_mode="Markdown"
        )
        return
    
    # Get filename from command args
    if not context.args:
        await update.message.reply_text(
            "❌ Please specify a filename.\n"
            "Usage: `/generate filename.json`",
            parse_mode="Markdown"
        )
        return
    
    filename = context.args[0]
    if not filename.endswith(".json"):
        filename += ".json"
    
    # Check if file exists
    scripts = get_available_scripts()
    if filename not in scripts:
        await update.message.reply_text(
            f"❌ Script not found: `{filename}`\n\n"
            f"Use `/list` to see available scripts.",
            parse_mode="Markdown"
        )
        return
    
    # Get audio mode (optional second argument)
    audio_mode = context.args[1] if len(context.args) > 1 else "gemini"
    if audio_mode not in ["gemini", "elevenlabs", "mac_say"]:
        audio_mode = "gemini"
    
    generation_status["running"] = True
    await update.message.reply_text(
        f"🎬 Starting reel generation...\n"
        f"📄 File: {filename}\n"
        f"🔊 Audio: {audio_mode}\n\n"
        f"Video will be sent when complete."
    )
    
    # Run generation in thread pool
    loop = asyncio.get_event_loop()
    
    async def send_video_result(success: bool, message: str, video_filename: str):
        """Send result and video to user."""
        if success:
            await update.message.reply_text(f"✅ {message}")
            
            # Get video path
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            if backend_dir not in sys.path:
                sys.path.insert(0, backend_dir)
            from config import OUTPUT_DIR
            
            video_path = os.path.join(OUTPUT_DIR, video_filename)
            
            if os.path.exists(video_path):
                try:
                    await update.message.reply_text("📤 Uploading video...")
                    with open(video_path, 'rb') as video_file:
                        await update.message.reply_video(
                            video=video_file,
                            caption=f"🎬 {video_filename}",
                            supports_streaming=True
                        )
                except Exception as e:
                    await update.message.reply_text(f"⚠️ Video generated but upload failed: {e}")
            else:
                await update.message.reply_text(f"⚠️ Video file not found at expected location")
        else:
            await update.message.reply_text(f"❌ {message}")
    
    def run_and_notify():
        global generation_status
        try:
            success, message = generate_reel_sync(filename, audio_mode)
            generation_status["running"] = False
            generation_status["progress"] = message
            
            # Video filename is same as json but with .mp4
            video_filename = filename.replace(".json", ".mp4")
            
            # Schedule notification and video send
            asyncio.run_coroutine_threadsafe(
                send_video_result(success, message, video_filename),
                loop
            )
        except Exception as e:
            generation_status["running"] = False
            generation_status["progress"] = f"Error: {e}"
            asyncio.run_coroutine_threadsafe(
                update.message.reply_text(f"❌ Error: {e}"),
                loop
            )
    
    executor.submit(run_and_notify)


async def generate_all_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Generate reels for all available scripts."""
    global generation_status
    
    if not is_authorized(update.effective_user.id):
        await unauthorized_response(update)
        return
    
    if generation_status["running"]:
        await update.message.reply_text(
            f"⏳ Generation already in progress for: `{generation_status['current_file']}`",
            parse_mode="Markdown"
        )
        return
    
    scripts = get_available_scripts()
    if not scripts:
        await update.message.reply_text("📁 No content scripts found.")
        return
    
    audio_mode = context.args[0] if context.args else "gemini"
    if audio_mode not in ["gemini", "elevenlabs", "mac_say"]:
        audio_mode = "gemini"
    
    generation_status["running"] = True
    await update.message.reply_text(
        f"🎬 Starting batch generation...\n"
        f"📄 Files: {len(scripts)}\n"
        f"🔊 Audio: {audio_mode}",
        parse_mode="Markdown"
    )
    
    loop = asyncio.get_event_loop()
    
    def run_batch():
        global generation_status
        results = []
        for i, script in enumerate(scripts, 1):
            generation_status["current_file"] = f"{script} ({i}/{len(scripts)})"
            success, msg = generate_reel_sync(script, audio_mode)
            results.append(f"{'✅' if success else '❌'} {script}")
        
        generation_status["running"] = False
        generation_status["progress"] = "Batch complete"
        
        result_text = "\n".join(results)
        asyncio.run_coroutine_threadsafe(
            update.message.reply_text(
                f"🎬 *Batch Generation Complete*\n\n{result_text}",
                parse_mode="Markdown"
            ),
            loop
        )
    
    executor.submit(run_batch)


async def status_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Check current generation status."""
    if not is_authorized(update.effective_user.id):
        await unauthorized_response(update)
        return
    
    if generation_status["running"]:
        await update.message.reply_text(
            f"🔄 *Generation in Progress*\n"
            f"📄 Current: `{generation_status['current_file']}`\n"
            f"📊 Status: {generation_status['progress']}",
            parse_mode="Markdown"
        )
    else:
        await update.message.reply_text(
            f"✅ No generation in progress.\n"
            f"Last status: {generation_status['progress'] or 'N/A'}",
            parse_mode="Markdown"
        )


async def script_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Generate a new script from a topic."""
    global generation_status
    
    if not is_authorized(update.effective_user.id):
        await unauthorized_response(update)
        return
    
    if generation_status["running"]:
        await update.message.reply_text(
            f"⏳ Generation already in progress: `{generation_status['current_file']}`",
            parse_mode="Markdown"
        )
        return
    
    if not context.args or len(context.args) < 2:
        await update.message.reply_text(
            "❌ Usage: `/script <topic> <filename>`\n\n"
            "*Example:*\n"
            "`/script benefits of morning exercise morning_workout`",
            parse_mode="Markdown"
        )
        return
    
    # Last argument is filename, rest is topic
    filename = context.args[-1]
    topic = " ".join(context.args[:-1])
    
    if not filename.endswith(".json"):
        filename += ".json"
    
    generation_status["running"] = True
    await update.message.reply_text(
        f"📝 Generating script...\n"
        f"📄 Topic: {topic}\n"
        f"💾 File: `{filename}`\n\n"
        f"Use `/status` to check progress.",
        parse_mode="Markdown"
    )
    
    loop = asyncio.get_event_loop()
    
    def run_script_gen():
        global generation_status
        try:
            success, message = generate_script_sync(topic, filename)
            generation_status["running"] = False
            generation_status["progress"] = message
            
            asyncio.run_coroutine_threadsafe(
                update.message.reply_text(
                    f"{'✅' if success else '❌'} {message}",
                    parse_mode="Markdown"
                ),
                loop
            )
        except Exception as e:
            generation_status["running"] = False
            generation_status["progress"] = f"Error: {e}"
    
    executor.submit(run_script_gen)


async def reel_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Full pipeline: Generate script -> Generate reel -> Generate caption -> Send."""
    global generation_status
    
    if not is_authorized(update.effective_user.id):
        await unauthorized_response(update)
        return
    
    if generation_status["running"]:
        await update.message.reply_text(
            f"⏳ Generation already in progress: `{generation_status['current_file']}`",
            parse_mode="Markdown"
        )
        return
    
    if not context.args:
        await update.message.reply_text("❌ Usage: `/reel <topic>`")
        return
    
    topic = " ".join(context.args)
    # Create a safe filename from topic
    safe_topic = "".join(c if c.isalnum() else "_" for c in topic)[:30].strip("_").lower()
    filename = f"{safe_topic}_{int(asyncio.get_event_loop().time())}.json"
    
    generation_status["running"] = True
    await update.message.reply_text(
        f"🎬 Starting Full Auto Generation...\n"
        f"📝 Topic: {topic}\n"
        f"🚀 Pipeline: Script -> Reel -> Caption\n\n"
        f"Sit back, this might take a minute!"
    )
    
    loop = asyncio.get_event_loop()
    
    async def send_full_result(success: bool, message: str, video_filename: str, caption: str):
        if success:
            await update.message.reply_text(f"✅ Reel Generated!")
            
            # Get video path
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            if backend_dir not in sys.path:
                sys.path.insert(0, backend_dir)
            from config import OUTPUT_DIR
            
            video_path = os.path.join(OUTPUT_DIR, video_filename)
            
            final_caption = caption if caption else f"🎬 {video_filename}"
            
            if os.path.exists(video_path):
                try:
                    await update.message.reply_text("📤 Uploading video...")
                    with open(video_path, 'rb') as video_file:
                        await update.message.reply_video(
                            video=video_file,
                            caption=final_caption,
                            supports_streaming=True
                        )
                except Exception as e:
                    await update.message.reply_text(f"⚠️ Video generated but upload failed: {e}")
            else:
                await update.message.reply_text(f"⚠️ Video file not found at expected location")
        else:
            await update.message.reply_text(f"❌ {message}")

    def run_full_pipeline():
        global generation_status
        try:
            # 1. Generate Script
            generation_status["progress"] = "Step 1/3: Writing Script..."
            script_success, script_msg = generate_script_sync(topic, filename)
            
            if not script_success:
                raise Exception(f"Script generation failed: {script_msg}")
                
            # 2. Generate Reel
            generation_status["progress"] = "Step 2/3: Creating Video..."
            reel_success, reel_msg = generate_reel_sync(filename, "gemini")
            
            if not reel_success:
                raise Exception(f"Reel generation failed: {reel_msg}")
                
            # 3. Generate Caption
            generation_status["progress"] = "Step 3/3: Writing Caption..."
            caption = generate_caption_sync(filename)
            
            generation_status["running"] = False
            generation_status["progress"] = "Pipeline Complete!"
            
            video_filename = filename.replace(".json", ".mp4")
            
            asyncio.run_coroutine_threadsafe(
                send_full_result(True, "Pipeline successful", video_filename, caption),
                loop
            )
            
        except Exception as e:
            generation_status["running"] = False
            generation_status["progress"] = f"Error: {e}"
            asyncio.run_coroutine_threadsafe(
                update.message.reply_text(f"❌ Error during pipeline: {e}"),
                loop
            )
            
    executor.submit(run_full_pipeline)


async def prompts_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """List available prompt templates."""
    if not is_authorized(update.effective_user.id):
        await unauthorized_response(update)
        return
    
    prompts = get_available_prompts()
    
    if not prompts:
        await update.message.reply_text("📋 No prompts found.")
        return
    
    prompts_list = "\n".join([f"• `{p}`" for p in sorted(prompts)])
    await update.message.reply_text(
        f"📋 *Available Prompts ({len(prompts)}):*\n\n{prompts_list}\n\n"
        f"_Default: blinked\\_thrice.txt_",
        parse_mode="Markdown"
    )


async def characters_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """List available characters."""
    if not is_authorized(update.effective_user.id):
        await unauthorized_response(update)
        return
    
    characters = get_available_characters()
    
    if not characters:
        await update.message.reply_text("👥 No characters found.")
        return
    
    chars_list = "\n".join([f"• {c}" for c in sorted(characters)])
    await update.message.reply_text(
        f"👥 *Available Characters ({len(characters)}):*\n\n{chars_list}\n\n"
        f"_Default pair: Aman & Isha_",
        parse_mode="Markdown"
    )


async def run_bot_async() -> None:
    """Asynchronous bot starter to ensure a clean event loop context."""
    if not TELEGRAM_BOT_TOKEN:
        print("TELEGRAM_BOT token not found in environment variables.")
        return

    if not AUTHORIZED_USERS:
        print("⚠️  Warning: No AUTHORIZED_TELEGRAM_USERS configured. All commands will be blocked.")
        print("   Add your Telegram user ID to .env to enable bot access.")

    # Create the Application
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Add handlers
    application.add_handler(CommandHandler("help", help_handler))
    application.add_handler(CommandHandler("ip", ip_handler))
    application.add_handler(CommandHandler("list", list_handler))
    application.add_handler(CommandHandler("generate", generate_handler))
    application.add_handler(CommandHandler("generate_all", generate_all_handler))
    application.add_handler(CommandHandler("status", status_handler))
    application.add_handler(CommandHandler("script", script_handler))
    application.add_handler(CommandHandler("reel", reel_handler))
    application.add_handler(CommandHandler("prompts", prompts_handler))
    application.add_handler(CommandHandler("characters", characters_handler))
    
    # Legacy text-based "ip" handler
    application.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND & filters.Regex(r'(?i)\bip\b'),
        ip_handler
    ))

    # Initialize and start
    print("🤖 Telegram Bot starting...")
    print(f"   Authorized users: {len(AUTHORIZED_USERS)} configured")
    print("   Commands: /help, /reel, /script, /prompts, /characters, /list, /generate, /status")
    
    # Use run_polling for proper lifecycle management
    await application.run_polling(poll_interval=3.0, stop_signals=None)


def start_bot() -> None:
    """Starts the bot. This is the entry point for the multiprocessing.Process."""
    import signal
    
    # Set up signal handlers for graceful shutdown
    def signal_handler(signum, frame):
        raise SystemExit(0)
    
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        asyncio.run(run_bot_async())
    except (KeyboardInterrupt, SystemExit):
        print("Bot process stopped.")
    except Exception as e:
        print(f"Error in bot process: {e}")
