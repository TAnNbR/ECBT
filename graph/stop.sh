cd /home/smx/ECBT/test

pkill -f "python3 -m http.server"
docker-compose down 
sudo rm -rf data/
pkill -f hardhat
