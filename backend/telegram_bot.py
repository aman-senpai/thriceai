import asyncio
import os
import socket
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Load environment variables
load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT")

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

async def ip_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Responds with the local IP address when 'ip' command/message is detected."""
    local_ip = get_local_ip_address()
    if local_ip:
        message = f"http://{local_ip}:3031"
    else:
        message = "Could not determine the local IP address."
    
    # Send the response back to the chat where the message originated
    try:
        await update.message.reply_text(message)
    except Exception as e:
        print(f"Error sending response: {e}")

async def run_bot_async() -> None:
    """Asynchronous bot starter to ensure a clean event loop context."""
    if not TELEGRAM_BOT_TOKEN:
        print("TELEGRAM_BOT token not found in environment variables.")
        return

    # Create the Application
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Add handlers
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND & filters.Regex(r'(?i)\bip\b'), ip_handler))
    application.add_handler(CommandHandler("ip", ip_handler))

    # Initialize and start
    print("Bot is starting... Type 'ip' or '/ip' in the channel to get the address.")
    
    # Use the context manager to ensure proper cleanup
    async with application:
        await application.initialize()
        await application.start()
        await application.updater.start_polling(poll_interval=3.0)
        
        # This keeps the bot running until it's stopped
        while True:
            await asyncio.sleep(3600) # Sleep for an hour and repeat

def start_bot() -> None:
    """Starts the bot. This is the entry point for the multiprocessing.Process."""
    try:
        # We use asyncio.run to create a new event loop in this process
        asyncio.run(run_bot_async())
    except KeyboardInterrupt:
        print("Bot process interrupted.")
    except Exception as e:
        print(f"Error in bot process: {e}")
