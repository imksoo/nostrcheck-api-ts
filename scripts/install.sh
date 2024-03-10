#!/bin/bash

# Detect the script base path
BASEDIR=$(dirname "$0")
echo "$BASEDIR"

readonly E_BADARGS=65
readonly version="0.2.1"
readonly date="20240306"

clear
echo ""
echo "███╗   ██╗ ██████╗ ███████╗████████╗██████╗  ██████╗██╗  ██╗███████╗ ██████╗██╗  ██╗ "
echo "████╗  ██║██╔═══██╗██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║  ██║██╔════╝██╔════╝██║ ██╔╝ "
echo "██╔██╗ ██║██║   ██║███████╗   ██║   ██████╔╝██║     ███████║█████╗  ██║     █████╔╝  "
echo "██║╚██╗██║██║   ██║╚════██║   ██║   ██╔══██╗██║     ██╔══██║██╔══╝  ██║     ██╔═██╗  "
echo "██║ ╚████║╚██████╔╝███████║   ██║   ██║  ██║╚██████╗██║  ██║███████╗╚██████╗██║  ██╗ "
echo "╚═╝  ╚═══╝ ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝ "
echo ""
echo "███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗ "
echo "██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗"
echo "███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝"
echo "╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗"
echo "███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║"
echo "╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝"
echo ""
echo "Nostrcheck server installation script v$version"
echo "Last updated: $date"
echo "Project repository: https://github.com/quentintaranpino/nostrcheck-api-ts/"
echo "----------------------------------------------------------------------------"
echo ""
echo "This script will install and configure the nostrcheck server on your system."
echo "WARNING: This script is still in development and may not work as expected."
echo ""

# Node version
NODE_MAJOR=21

# Variables
HOST=""
DB="nostrcheck"
USER="nostrcheck"
MEDIAPATH="media/"
PUBKEY=""
SECRETKEY=""

# We ask user if want to continue
echo "Do you want to proceed with the installation? [y/n]"
echo ""
read -r input
if [ "$input" != "y" ]; then
    echo "Exiting..."
    exit $E_BADARGS
fi

# Install Node.js
clear
echo "Installing Node.js..."
echo ""
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
# if /etc/apt/keyrings does not exist, create it
if [ ! -d "/etc/apt/keyrings" ]; then
    sudo mkdir -p /etc/apt/keyrings
fi
# if /etc/apt/keyrings/nodesource.gpg exist remove it
if [ -f "/etc/apt/keyrings/nodesource.gpg" ]; then
    sudo rm /etc/apt/keyrings/nodesource.gpg
fi
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt-get update
sudo apt-get install nodejs -y

# Install necessary packages
clear
echo "Installing necessary packages..."
echo ""
sudo apt install nginx git redis-server mariadb-server mariadb-client ffmpeg jq certbot python3-certbot-nginx -y

# Clone the repository
clear
echo "Cloning the repository..."
echo ""
#git clone https://github.com/quentintaranpino/nostrcheck-api-ts.git
git clone -b '0.5.0' https://github.com/quentintaranpino/nostrcheck-api-ts.git

# Prepare installation directory
cd nostrcheck-api-ts

# Install dependencies
clear
echo "Installing latest npm package manager"
echo ""
sudo npm install -g npm@latest

# install dependencies
clear
echo "Installing dependencies..."
echo ""
npm install --include=optional sharp

# Build the project
clear
echo "Building..."
echo ""
npm run build

# Starting services
clear
echo "Starting services..."
echo ""
sudo service start redis-server
sudo service start mariadb

# MYSQL
clear
readonly MYSQL=`which mysql`
echo "Database name [default: $DB]:"
echo ""
read -r inputDB
if [ ! -z "$inputDB" ]; then
    DB=$inputDB
fi

clear
echo "Database user [default: $USER]:"
echo ""
read -r inputUSER
if [ ! -z "$inputUSER" ]; then
    USER=$inputUSER
fi

# Generate a random password for database user
clear
PASS=`openssl rand -base64 32`
echo "Generating password for user $USER..."
echo ""

# Generate a random secret for session
SECRET=`openssl rand -base64 32`
echo "Generating secret for session cookies..."
echo ""

# Construct the MySQL query
readonly Q1="CREATE DATABASE IF NOT EXISTS $DB ;"
readonly Q2="GRANT ALL ON $DB.* TO '$USER'@'localhost' IDENTIFIED BY '$PASS';"
readonly Q3="FLUSH PRIVILEGES;"
readonly SQL="${Q1}${Q2}${Q3}"

# Run the actual command
sudo $MYSQL -uroot -e "$SQL"

# Let the user know the database was created
echo ""
echo "Database tables and user created successfully!"
echo ""

# Set hostname
clear
echo "Server hostname: (ex. nostrcheck.me):"
echo ""
echo "WARNING: This hostname will be used to create the nginx configuration file."
echo "If you want to use SSL, make sure to have a valid domain name and DNS records pointing to this server."
echo ""
read -r inputHOST
if [ ! -z "$inputHOST" ]; then
    HOST=$inputHOST
fi

# if HOST is empty, prompt another time
if [ -z "$HOST" ]; then
    clear
    echo "WARNING: Server hostname is required to continue the installation."
    echo ""
    echo "Server hostname: (ex. nostrcheck.me):"
    echo ""
    echo "WARNING: This hostname will be used to create the nginx configuration file."
    echo "If you want to use SSL, make sure to have a valid domain name and DNS records pointing to this server."
    echo "The hostname is required to continue the installation."
    echo ""
    read -r inputHOST
    if [ ! -z "$inputHOST" ]; then
        HOST=$inputHOST
    fi
fi

# if HOST is still empty, exit
if [ -z "$HOST" ]; then
    echo "cant install without server hostname, exiting..."
    exit $E_BADARGS
fi

# Set media path
clear
echo "Media path [default: $MEDIAPATH]:"
echo ""
echo "WARNING: This path will be used to store media files on the filesystem."
echo "If you want to use a different path, make sure to have the necessary permissions."
echo ""
read -r inputMEDIAPATH
if [ ! -z "$inputMEDIAPATH" ]; then
    MEDIAPATH=$inputMEDIAPATH
fi

# Prompt user for server pubkey (hex)
clear
echo "Server public key (HEX format):"
echo ""
echo "You can use https://nostrcheck.me/converter/ for convert your pubkey to HEX format" 
echo "INFO: Leave it empty if you want to generate a new pubkey/secret"
echo ""
read -r PUBKEY

# if PUBKEY is not empty, prompt user for server SECRET key.
if [ ! -z "$PUBKEY" ]; then
    clear
    echo "Server secret key (HEX format):"
    echo ""
    echo "You can use https://nostrcheck.me/converter/ for convert your nsec to HEX format" 
    echo ""
    read -r SECRETKEY

    # if SECRETKEY is empty, prompt another time
    if [ -z "$SECRETKEY" ]; then
        clear
        echo "WARNING: Server secret key is required if you provide a pubkey"
        echo "If you are not confortable with this leave it blank to generate a new public and secret keypair."
        echo ""
        echo "Server secret key (HEX format):"
        echo ""
        echo "You can use https://nostrcheck.me/converter/ for convert your nsec to HEX format"
        echo ""
        read -r SECRETKEY

        # if SECRETKEY is still empty, remove PUBKEY value
        if [ -z "$SECRETKEY" ]; then
            PUBKEY=""
        fi
    fi
fi

# Update local.json with generated fields.
clear
echo ""
echo "Creating user config file..."
cp config/default.json config/local.json

jq --arg a "$HOST" '.server.host = $a' config/local.json > tmp.json && mv tmp.json config/local.json
jq --arg a "$PUBKEY" '.server.pubkey = $a' config/local.json > tmp.json && mv tmp.json config/local.json
jq --arg a "$SECRETKEY" '.server.secretKey = $a' config/local.json > tmp.json && mv tmp.json config/local.json
jq --arg a "$DB" '.database.database = $a' config/local.json > tmp.json && mv tmp.json config/local.json
jq --arg a "$USER" '.database.user = $a' config/local.json > tmp.json && mv tmp.json config/local.json
jq --arg a "$PASS" '.database.password = $a' config/local.json > tmp.json && mv tmp.json config/local.json
jq --arg a "$MEDIAPATH" '.media.mediaPath = $a' config/local.json > tmp.json && mv tmp.json config/local.json
jq --arg a "$SECRET" '.session.secret = $a' config/local.json > tmp.json && mv tmp.json config/local.json


# Create nginx config file
echo ""
echo "Creating nginx config file..."
echo ""

cat > /etc/nginx/sites-available/$HOST.conf <<EOF
server {
    listen 80;
    server_name $HOST;

    location / {
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Host \$host;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
    }

    #API redirect for nostr.json requests
    location /.well-known/nostr.json {

      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$scheme;
      proxy_set_header Host \$host;
      proxy_pass http://localhost:3000/api/v2/nostraddress;
      proxy_http_version 1.1;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection "upgrade";

    }

    #API redirect for nip96.json requests
    location /.well-known/nostr/nip96.json {

      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$scheme;
      proxy_set_header Host \$host;
      proxy_pass http://127.0.0.1:3000/api/v2/nip96;
      proxy_http_version 1.1;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection "upgrade";

    }

    #API redirect for lightning redirect requests
    location /.well-known/lnurlp/ {

        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Host \$host;
        proxy_pass http://127.0.0.1:3000/api/v2/lightningaddress/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

    }

    #API redirect for media URL requests
    location /media {
       proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto \$scheme;
       proxy_set_header Host \$host;
       proxy_pass http://127.0.0.1:3000/api/v2/media;
       proxy_http_version 1.1;
       proxy_set_header Upgrade \$http_upgrade;
       proxy_set_header Connection "upgrade";
     }
}
EOF

# Enable the site
echo "Enabling nginx site..."
echo ""
ln -s /etc/nginx/sites-available/$HOST.conf /etc/nginx/sites-enabled/$HOST.conf

# Restart nginx
echo ""
echo "Restarting nginx..."
echo ""
sudo service nginx restart

# End of standard installation
clear
echo "Installation complete!"
echo ""

# Ask user if want to creat a service for the server
clear
echo "Do you want to create a systemd service for the server? [y/n]"
echo ""
read -r input
if [ "$input" = "y" ]; then
    echo ""
    echo "Creating systemd service..."
    echo ""

    cat > /etc/systemd/system/nostrcheck.service <<EOF
[Unit]
Description=Nostrcheck server
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$ABSOLUTE_PATH/nostrcheck-api-ts
ExecStart=/usr/bin/npm run start
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
clear
echo ""
echo "Enabling and starting the service..."
echo ""
sudo systemctl enable nostrcheck
sudo systemctl start nostrcheck

fi

# Ask user if want to execute certbot for SSL
clear
echo ""
echo "Do you want to execute certbot for SSL certificate " $HOST"? [y/n]"
echo ""
read -r input
if [ "$input" = "y" ]; then
    echo ""
    echo "Executing certbot SSL certificate for " $HOST"..."
    echo ""
    sudo certbot --nginx -d $HOST

    # Restart nginx
    echo ""
    echo "Restarting nginx..."
    echo ""
    sudo service nginx restart

fi

clear
# End message
echo "-------------------------------------------------------------------------------------------"
echo "-                                                                                         -"
echo "-  You can now start nostrcheck server by running 'cd nostrcheck-api-ts && npm run start' -"
echo "-                                                                                         -"
echo "-  Server documentation:                                                                  -"
echo "-  https://github.com/quentintaranpino/nostrcheck-api-ts/blob/main/DOCS.md                -" 
echo "-                                                                                         -"
echo "-  If you like this project, please consider donating to keep it alive:                   -"
echo "-  https://nostrcheck.me/about/support-us.php                                             -"
echo "-                                                                                         -"
echo "-  WARNING:                                                                               -" 
echo "-  The first time you visit the server's frontend, it will autologin with server admin    -"
echo "-  user (public) and it will send a new password to its pubkey via DM. Please, make sure  -"
echo "-  that you are able to login with the new password before closing this session.          -"
# if PUBKEY was empty show a message
if [ -z "$PUBKEY" ]; then
echo "-                                                                                         -"   
echo "-  Please execute the server once to generate the server pubkey and secret key, the new   -"
echo "-  generated keys will be stored in config/local.json file.                               -"
fi
echo "-                                                                                         -" 
echo "-------------------------------------------------------------------------------------------"