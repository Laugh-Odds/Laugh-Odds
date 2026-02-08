// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FunnyOrFud {
    struct Meme {
        address creator;
        string cid;
        uint256 memeTemplate;
    }

    struct Market {
        address creator;
        uint256 endTime;
        bool isActive;
        string metadata;
        Meme[] memes;
    }

    uint256 public marketCount;
    mapping(uint256 => Market) public markets;

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        uint256 endTime,
        string metadata
    );

    event MemeCreated(uint256 templateId);

    modifier marketExists(uint256 marketId) {
        require(marketId < marketCount, "Market does not exist");
        _;
    }

    modifier onlyActiveMarket(uint256 marketId) {
        require(markets[marketId].isActive, "Market is not active");
        _;
    }

    function getMarketCount() external view returns (uint256) {
        return marketCount;
    }

    function getMarketMemes(
        uint256 marketId
    ) external view marketExists(marketId) returns (Meme[] memory) {
        return markets[marketId].memes;
    }

    function createMarket(string memory metadata) external {
        uint256 endTime = block.timestamp + 6 hours;

        Market storage newMarket = markets[marketCount];
        newMarket.creator = msg.sender;
        newMarket.endTime = endTime;
        newMarket.isActive = true;
        newMarket.metadata = metadata;

        emit MarketCreated(marketCount, msg.sender, endTime, metadata);

        marketCount++;
    }

    function createMeme(
        address creator,
        string memory cid,
        uint256 templateId
    ) external marketExists(templateId) {
        Meme memory newM = Meme(creator, cid, templateId);

        markets[templateId].memes.push(newM);

        emit MemeCreated(templateId);
    }

    function getMarket(
        uint256 marketId
    )
        external
        view
        marketExists(marketId)
        returns (
            address creator,
            uint256 endTime,
            bool isActive,
            string memory metadata,
            Meme[] memory memes
        )
    {
        Market storage market = markets[marketId];
        return (
            market.creator,
            market.endTime,
            market.isActive,
            market.metadata,
            market.memes
        );
    }
}
