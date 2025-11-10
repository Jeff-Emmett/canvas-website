#!/bin/bash

# Script to start development servers with network access
# Based on: https://dev.to/dnlcorona/running-a-development-server-on-wsl2-and-connecting-devices-to-the-server-via-port-forwarding-on-the-local-network-50m7

echo "🚀 Starting development servers with network access..."

# Get WSL2 IP addresses
WSL_IP=$(hostname -I | awk '{print $1}')
echo "📍 WSL2 IP: $WSL_IP"

# Get Windows IP (if running in WSL2)
if command -v ipconfig &> /dev/null; then
    WINDOWS_IP=$(ipconfig | grep "IPv4" | head -1 | awk '{print $NF}')
else
    # Try to get Windows IP from WSL2
    WINDOWS_IP=$(ip route | grep default | awk '{print $3}')
fi

echo "📍 Windows IP: $WINDOWS_IP"

echo ""
echo "🌐 Your servers will be accessible at:"
echo "   Localhost:"
echo "     - Client:  http://localhost:5173"
echo "     - Worker:  http://localhost:5172"
echo ""
echo "   Network (from other devices):"
echo "     - Client:  http://$WSL_IP:5173"
echo "     - Worker:  http://$WSL_IP:5172"
echo ""
echo "   Windows (if port forwarding is set up):"
echo "     - Client:  http://$WINDOWS_IP:5173"
echo "     - Worker:  http://$WINDOWS_IP:5172"
echo ""
echo "✅ The client will automatically connect to the worker using the same hostname"
echo "   This means remote devices will connect to the worker at the correct IP address."
echo ""

# Check if we're in WSL2
if [[ -f /proc/version ]] && grep -q Microsoft /proc/version; then
    echo "🔧 WSL2 detected! To enable access from Windows and other devices:"
    echo "   1. Run this in Windows PowerShell as Administrator:"
    echo "      netsh advfirewall firewall add rule name=\"WSL2 Dev Server\" dir=in action=allow protocol=TCP localport=5173"
    echo "      netsh advfirewall firewall add rule name=\"WSL2 Worker Server\" dir=in action=allow protocol=TCP localport=5172"
    echo ""
    echo "   2. Set up port forwarding (run in Windows PowerShell as Administrator):"
    echo "      netsh interface portproxy add v4tov4 listenport=5173 listenaddress=$WINDOWS_IP connectport=5173 connectaddress=$WSL_IP"
    echo "      netsh interface portproxy add v4tov4 listenport=5172 listenaddress=$WINDOWS_IP connectport=5172 connectaddress=$WSL_IP"
    echo ""
    echo "   3. Verify port forwarding:"
    echo "      netsh interface portproxy show v4tov4"
    echo ""
fi

echo "🎯 Starting servers..."
echo ""
echo "🔍 Debug info:"
echo "   - Client will connect to worker at: http://[same-hostname]:5172"
echo "   - If accessing from remote device, both client and worker URLs should use the same IP"
echo "   - Check browser console for any connection errors"
echo ""
echo "🔧 Troubleshooting:"
echo "   - If other devices can't connect, check:"
echo "     1. Both devices are on the same WiFi network"
echo "     2. Windows Firewall allows ports 5173 and 5172"
echo "     3. WSL2 port forwarding is set up (see instructions above)"
echo "     4. Try accessing from Windows first: http://172.22.160.1:5173"
echo ""

# Export WSL2 IP for Vite configuration
export WSL2_IP=$WSL_IP

npm run dev
