# using AWS EC2 image: ami-428aa838 (Amazon Linux 2 LTS Candidate AMI 2017.12.0 (HVM))

# ssh into the server
# sudo yum update

# install git to checkout the project on your server
sudo yum install git

# this will install NodeJS (you need at least version 9 as per requirements)
curl --silent --location https://rpm.nodesource.com/setup_9.x | sudo bash -
sudo yum install -y nodejs

# install non-standard python3 on Amazon Linux (this installs pip3)
sudo amazon-linux-extras install python3
# on Fedora/RedHat:
# sudo yum install python3

# install python3 packages using pip3
pip3 install --user python-arango
pip3 install --user xmljson
pip3 install --user python-dotenv

# this is used to fix some vulnerabilities problem when running 'npm install'
sudo yum install patch

cd ~
git clone -b master https://github.com/OriginTrail/ot-node.git
cd ot-node && npm install
cp .env.example .env

echo "Installation complete. Please configure .env file."