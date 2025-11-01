import asyncio
import os
import socket
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Load environment variables
load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT")
# TELEGRAM_CHAT_ID is not needed here as the bot responds in the channel it receives the message from

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


def start_bot() -> None:
    """Starts the bot."""
    if not TELEGRAM_BOT_TOKEN:
        print("TELEGRAM_BOT token not found in environment variables.")
        return

    # Create the Application and pass it your bot's token.
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Add a message handler that filters for the exact text "ip" in the channel
    # This responds whether the user types "ip", "IP", "Ip", etc.
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND & filters.Regex(r'(?i)\bip\b'), ip_handler))

    # Add a command handler for the traditional /ip command as well
    application.add_handler(CommandHandler("ip", ip_handler))

    # Run the bot until the user presses Ctrl-C or the process receives SIGINT, SIGTERM or SIGABRT
    print("Bot is running... Type 'ip' or '/ip' in the channel to get the address.")
    application.run_polling(poll_interval=3.0)


