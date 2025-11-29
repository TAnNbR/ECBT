cd /home/smx/ECBT/test

echo "=== 1. 清理旧服务 ==="
pkill -f hardhat
docker-compose down 
sudo rm -rf data/
pkill -f "python3 -m http.server"
sleep 5

echo "=== 2. 启动 Hardhat 节点 ==="
npx hardhat node --hostname 0.0.0.0 > hardhatNode.log 2>&1 &
sleep 5

echo "=== 3. 部署合约并启动测试 ==="
npx hardhat run scripts/testOrderbook.js --network localhost > testOrderbook.log 2>&1 &
sleep 10

echo "=== 4. 启动 Graph ==="
docker-compose up -d
sleep 10

echo "=== 5. 部署 subgraph ==="
cd subgraph
npx graph build
npx graph create --node http://localhost:8020/ orderbook
sleep 10
npx graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 --version-label v1 orderbook
cd ..

echo "=== 6. 启动前端 ==="
python3 -m http.server 8080 > /dev/null 2>&1 &


