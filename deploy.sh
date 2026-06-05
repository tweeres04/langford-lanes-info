ssh server -T <<'EOL'
	cd langford-lanes-info && \
	git fetch && git reset --hard origin/main && \
	docker compose up --build -d
EOL
